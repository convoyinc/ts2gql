import * as doctrine from 'doctrine';
import * as _ from 'lodash';
import * as typescript from 'typescript';
import * as path from 'path';

import * as util from './util';
import { Collector, CollectorType } from './Collector';
import Emitter from './Emitter';

export function load(schemaRootPath:string, rootNodeNames:string[]):CollectorType {
  schemaRootPath = path.resolve(schemaRootPath);
  const program = typescript.createProgram([schemaRootPath], {});
  const schemaRoot = program.getSourceFile(schemaRootPath);
  if (!schemaRoot) {
    throw new Error(`Could not Parse TypeScript AST of file ${schemaRootPath}`);
  }

  const interfaces:{[key:string]:typescript.InterfaceDeclaration} = {};
  typescript.forEachChild(schemaRoot, (node) => {
    if (!isNodeExported(node)) return;
    if (node.kind === typescript.SyntaxKind.InterfaceDeclaration) {
      const interfaceNode = <typescript.InterfaceDeclaration>node;
      interfaces[interfaceNode.name.text] = interfaceNode;

      const documentation = util.documentationForNode(interfaceNode, schemaRoot.text);
      const isSchemaRoot = documentation && _.find(documentation.tags, (tag:doctrine.Tag) => {
        return tag.title === 'graphql' && /^[Ss]chema$/.test(tag.description);
      });
      if (isSchemaRoot) {
        rootNodeNames.push(interfaceNode.name.text);
      }
    }
  });

  rootNodeNames = _.uniq(rootNodeNames);
  if (rootNodeNames.length === 0) {
    throw new Error(`GraphQL Schema declaration not found`);
  }

  const collector = new Collector(program);
  for (const name of rootNodeNames) {
    const rootInterface = interfaces[name];
      if (!rootInterface) {
      throw new Error(`No interface named ${name} was exported by ${schemaRootPath}`);
    }
    collector.addRootNode(rootInterface);
  }

  _.each(interfaces, (node, name) => {
    const documentation = util.documentationForNode(node);
    if (!documentation) return;
    const override = _.find(documentation.tags, (tag:doctrine.Tag) => {
      return tag.title === 'graphql' && /^[Oo]verride$/.test(tag.description);
    });
    if (!override) return;
    const overrideName = override.description.split(' ')[1] || name!;
    collector.mergeOverrides(node, overrideName);
  });

  return collector;
}

export function emit(
  schemaRootPath:string,
  rootNodeNames:string[],
  stream:NodeJS.WritableStream = process.stdout,
):void {
  const loadedTypes = load(schemaRootPath, rootNodeNames);
  const emitter = new Emitter(loadedTypes);
  emitter.emitAll(stream);
}

function isNodeExported(node:typescript.Node):boolean {
  return !!node.modifiers && node.modifiers.some(m => m.kind === typescript.SyntaxKind.ExportKeyword);
}
