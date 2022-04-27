'use strict';

const JSON5 = require('json5');
const { optimize } = require('svgo');
const { compileTemplate } = require('@vue/compiler-sfc');

const specialValues = {
  null: null,
  true: true,
  false: false,
};

let resPath;

function parseQuery (query)
{
  if (query.substr(0, 1) !== '?')
  {
    throw new Error('A valid query string passed to parseQuery should begin with "?"');
  }

  query = query.substr(1);

  if (!query)
  {
    return {};
  }

  if (query.substr(0, 1) === '{' && query.substr(-1) === '}')
  {
    return JSON5.parse(query);
  }

  const queryArgs = query.split(/[,&]/g);
  const result = {};

  queryArgs.forEach((arg) =>
  {
    const idx = arg.indexOf('=');

    if (idx >= 0)
    {
      let name = arg.substr(0, idx);
      let value = decodeURIComponent(arg.substr(idx + 1));

      if (specialValues.hasOwnProperty(value))
      {
        value = specialValues[value];
      }

      if (name.substr(-2) === '[]')
      {
        name = decodeURIComponent(name.substr(0, name.length - 2));

        if (!Array.isArray(result[name]))
        {
          result[name] = [];
        }

        result[name].push(value);
      }
      else
      {
        name = decodeURIComponent(name);
        result[name] = value;
      }
    }
    else
    {
      if (arg.substr(0, 1) === '-')
      {
        result[decodeURIComponent(arg.substr(1))] = false;
      }
      else if (arg.substr(0, 1) === '+')
      {
        result[decodeURIComponent(arg.substr(1))] = true;
      }
      else
      {
        result[decodeURIComponent(arg)] = true;
      }
    }
  });

  return result;
}

function getOptions (loaderContext)
{
  const query = loaderContext.query;

  if (typeof query === 'string' && query !== '')
  {
    return parseQuery(loaderContext.query);
  }

  if (!query || typeof query !== 'object')
  {
    // Not object-like queries are not supported.
    return null;
  }

  return query;
}

function compileSvg(source)
{
  let { code } = compileTemplate({
    id: resPath,
    source,
    transformAssetUrls: false,
  });

  code = code.replace('export function render', 'function render');
  code += `\nexport default { render };`;

  return code;
}

function svgToVue (content, options = {})
{
  const {
    svgoConfig = {},
    svgoPath = null,
  } = options;

  let result = content;

  if (svgoConfig !== false)
  {
    result = optimize(content, {
      ...svgoConfig,
      path: svgoPath
    }).data;
  }

  const component = compileSvg(result)
  return component
}

module.exports = function(content)
{
  const callback = this.async();
  resPath = this.resourcePath;
  const { svgo } = getOptions(this) || {};

  try
  {
    const result = svgToVue(content, {
      svgoPath: this.resourcePath,
      svgoConfig: svgo,
    });
    callback(null, result);
  }
  catch (e)
  {
    callback();
  }
};
