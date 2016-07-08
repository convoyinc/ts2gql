import * as _ from 'lodash';
import * as typescript from 'typescript';
import * as path from 'path';

import Collector from './Collector';

export function load(schemaRootPath:string, queryInterfaceName:string) {
  schemaRootPath = path.resolve(schemaRootPath);
  const program = typescript.createProgram([schemaRootPath], {});
  const schemaRoot = program.getSourceFile(schemaRootPath);

  const interfaces:{[key:string]:typescript.InterfaceDeclaration} = {};
  typescript.forEachChild(schemaRoot, (node) => {
    if (!isNodeExported(node)) return;
    if (node.kind === typescript.SyntaxKind.InterfaceDeclaration) {
      const interfaceNode = <typescript.InterfaceDeclaration>node;
      interfaces[interfaceNode.name.text] = interfaceNode;
    }
  });

  const queryInterface = interfaces[queryInterfaceName];
  if (!queryInterface) {
    throw new Error(`No interface named ${queryInterfaceName} was exported by ${schemaRootPath}`);
  }

  const collector = new Collector(program);
  collector.addQueryNode(queryInterface);

  console.log('------------');
  console.log('collector types:', JSON.stringify(collector.types, null, 2));
}

function isNodeExported(node:typescript.Node):boolean {
  return (node.flags & typescript.NodeFlags.Export) !== 0
    || (node.parent && node.parent.kind === typescript.SyntaxKind.SourceFile);
}
