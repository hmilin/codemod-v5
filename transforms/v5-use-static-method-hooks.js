const {
  addSubmoduleImport,
  parseStrToArray,
} = require('./utils');
const { printOptions } = require('./utils/config');

const changeRouts = {
  message: {
    propertyName: 'message',
    staticMethods: ['success', 'error', 'info', 'warning', 'loading']
  },
  notification: {
    propertyName: 'notification',
    staticMethods: ['success', 'error', 'info', 'warning', 'open']
  },
  Modal: {
    propertyName: 'modal',
    staticMethods: ['info', 'success', 'error', 'warning', 'confirm']
  },
}


module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  const antdPkgNames = parseStrToArray(options.antdPkgNames || 'antd');

  // import { message, notification } from 'antd'
  function replaceDeprecatedComponent(j, root) {
    let hasChanged = false;

    hasChanged = replaceImportStatement(j, root);

    if (hasChanged) {
      addHooksExpression(j, root);
    }

    return hasChanged;
  }

  // import { message, notification } from 'antd'
  // => import { App as AntdApp } from 'antd'
  function replaceImportStatement(j, root) {
    let hasChanged = false;

    const componentNames = Object.keys(changeRouts);

    root
      .find(j.Identifier)
      .filter(
        path =>
          componentNames.includes(path.node.name) &&
          path.parent.node.type === 'ImportSpecifier' &&
          antdPkgNames.includes(path.parent.parent.node.source.value),
      )
      .forEach(path => {
        const importedComponentName = path.parent.node.imported.name;
        const antdPkgName = path.parent.parent.node.source.value;

        // remove old imports
        const importDeclaration = path.parent.parent.node;
        // static method called times
        const methodCalledTimes = root.find(j.CallExpression, {
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'Identifier',
              name: importedComponentName,
            },
          },
        })?.length;
        // all times called
        const allTimes = root.find(j.Identifier, importedComponentName);
        if (methodCalledTimes > 0) {
          hasChanged = true;
          importDeclaration.specifiers = importDeclaration.specifiers.filter(
            specifier =>
              !specifier.imported ||
              specifier.imported.name !== importedComponentName ||
              allTimes > methodCalledTimes,
          );

          // add { App as AntdApp } from 'antd'
          addSubmoduleImport(j, root, {
            moduleName: antdPkgName,
            importedName: 'App',
            localName: 'AntdApp',
          });
        }

      });

    return hasChanged;
  }

  function addHooksExpression(j, root) {
    root.find(j.Program).get('body').filter(isFunction).forEach((fcNode) => {
      const importedList = [];
      // find static method called
      Object.entries(changeRouts).forEach(([msgApiName, value]) => {
        const appName = value.propertyName;
        value.staticMethods.forEach((methodName) => {
          j(fcNode).find(j.CallExpression, {
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'Identifier',
                name: msgApiName,
              },
              property: {
                type: 'Identifier',
                name: methodName,
              },
            },
          }).forEach((path) => {
            if (!importedList.includes(appName)) {
              importedList.push(appName);
            }
            if (msgApiName !== appName) {
              path.node.callee.object.name = appName;
            }
          });
        })
      });

      if (importedList.length) {
        // add const { path.node.name } = AntdApp.useApp()
        const hooksDeclarator = j.variableDeclaration('const',
          [
            j.variableDeclarator(
              j.objectPattern(importedList.map((n) => {
                const property = j.property('init', j.identifier(n), j.identifier(n));
                // { notificaiton: notificaiton } => { notificaiton }
                property.shorthand = true;
                return property;
              })),
              j.callExpression(
                j.memberExpression(j.identifier('AntdApp'), j.identifier('useApp')), [])
            )
          ]
        );

        if (fcNode.node.type === 'VariableDeclaration') {
          fcNode.get('declarations', '0', 'init', 'body', 'body').unshift(hooksDeclarator);
        } else if (fcNode.node.type === 'FunctionDeclaration') {
          fcNode.get('body', 'body').unshift(hooksDeclarator);
        }
      }

    })
  }

  // step1. replace imported components with AntdApp
  let hasChanged = false;
  hasChanged = replaceDeprecatedComponent(j, root) || hasChanged;

  return hasChanged
    ? root.toSource(options.printOptions || printOptions)
    : null;
};

function isFunction(path) {
  return path.node.type === 'FunctionDeclaration' || (path.node.type === 'VariableDeclaration' && path.get('declarations', 0, 'init').node?.type === 'ArrowFunctionExpression');
}
