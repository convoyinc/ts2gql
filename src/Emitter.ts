import * as _ from 'lodash';
import * as types from './types';
import * as util from './util';
import { CollectorType } from './Collector';

// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
export default class Emitter {
  private typeMap:types.TypeDefinitionMap;
  private root:types.SchemaDefinitionNode;
  constructor(collector:CollectorType) {
    this.typeMap = collector.types;
    if (!collector.root) {
      throw new Error(`Empty schema definition.`);
    }
    this.root = collector.root;
  }

  emitAll(stream:NodeJS.WritableStream) {
    stream.write('\n');
    this.typeMap.forEach((node, name) => {
      const content = this.emitTopLevelNode(node, name, stream);
      if (content) {
        stream.write(`${content}\n\n`);
      }
    });

    stream.write(`${this.emitSchema()}\n`);
  }

  emitTopLevelNode(node:types.TypeDefinitionNode, name:types.SymbolName, stream:NodeJS.WritableStream):string {
    let content;
    switch (node.kind) {
      case types.GQLDefinitionKind.OBJECT_DEFINITION:
        content = this._emitObject(node, name);
        break;
      case types.GQLDefinitionKind.INTERFACE_DEFINITION:
        content = this._emitInterface(node, name);
        break;
      case types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION:
        content = this._emitInputObject(node, name);
        break;
      case types.GQLDefinitionKind.ENUM_DEFINITION:
        content = this._emitEnum(node, name);
        break;
      case types.GQLDefinitionKind.UNION_DEFINITION:
        content = this._emitUnion(node, name);
        break;
      case types.GQLDefinitionKind.SCALAR_DEFINITION:
        content = this._emitScalarDefinition(node, name);
        break;
      case types.GQLDefinitionKind.DEFINITION_ALIAS:
        const aliased = this.typeMap[node.target];
        content = this.emitTopLevelNode(aliased, name, stream);
        break;
      default:
        throw new Error(`Unsupported top level node '${name}'.`);
    }
    return content;
  }

  emitSchema() {
    const properties = [
      `query: ${this.root.query}`,
      this.root.mutation ? `mutation: ${this.root.mutation}` : '',
    ];
    return `schema {\n${this._indent(properties)}\n}`;
  }

  // Specialized emitters

  _emitObject(node:types.ObjectTypeDefinitionNode, name:string):string {
    return `type ${this._name(name)} {\n${this._emitFields(node.fields)}\n}`;
  }

  _emitInterface(node:types.InterfaceTypeDefinitionNode, name:types.SymbolName):string {
    return `interface ${this._name(name)} {\n${this._emitFields(node.fields)}\n}`;
  }

  _emitFields(fields:types.FieldDefinitionNode[]) {
    const emitted = fields.map(field => this._emitField(field));
    return this._indent(emitted);
  }

  _emitField(field:types.FieldDefinitionNode) {
    const argumentList = this._emitArguments(field.arguments);
    const directives = this._emitFieldDirectives(field.directives);
    return `${this._name(field.name)}${argumentList}: ${this._emitExpression(field.type)} ${directives}`;
  }

  _emitArguments(args?:(types.InputValueDefinitionNode | types.DirectiveInputValueNode)[]):string {
    return args ? `(${args.map(this._emitInputValue).join(', ')})` : '';
  }

  _emitInputValue(node:types.InputValueDefinitionNode | types.DirectiveInputValueNode):string {
    return `${this._name(node.name)}: ${this._emitExpression(node.value)}`;
  }

  _emitFieldDirectives(directives?:types.DirectiveDefinitionNode[]):string {
    return directives ? directives.map((directive:types.DirectiveDefinitionNode) => {
      const emittedArgs = this._emitArguments(directive.args);
      return `@${directive.name}${emittedArgs}`;
    }).join(' ') : '';
  }

  _emitInputObject(node:types.InputObjectTypeDefinition, name:types.SymbolName):string {
    return `input ${this._name(name)} {\n${this._emitFields(node.fields)}\n}`;
  }

  _emitEnum(node:types.EnumTypeDefinitionNode, name:types.SymbolName):string {
    return `enum ${this._name(name)} {\n${this._indent(node.values)}\n}`;
  }

  _emitUnion(node:types.UnionTypeDefinitionNode, name:types.SymbolName):string {
    const nodeNames = node.members.map(member => member.target);
    return `union ${this._name(name)} = ${nodeNames.join(' | ')}`;
  }

  _emitScalarDefinition(node:types.ScalarTypeDefinitionNode, name:types.SymbolName):string {
    return node.builtIn ? '' : `scalar ${this._name(name)}`;
  }

  _emitReference(node:types.ReferenceTypeNode):string {
    return this._name(node.target);
  }

  _emitExpression = (node:types.TypeNode|types.ValueNode):string => {
    if (node.kind === types.GQLTypeKind.VALUE) {
      return `${node.value}`;
    }
    const required = node.nullable ? '' : '!';
    if (util.isReferenceType(node)) {
      return `${this._name(node.target)}${required}`;
    }
    if (node.kind === types.GQLTypeKind.LIST_TYPE) {
      return `[${this._emitExpression(node.wrapped)}]${required}`;
    }
    if (node.kind === types.GQLTypeKind.STRING_TYPE) {
      return 'String';
    }
    if (node.kind === types.GQLTypeKind.FLOAT_TYPE) {
      return 'Float';
    }
    if (node.kind === types.GQLTypeKind.INT_TYPE) {
      return 'Int';
    }
    if (node.kind === types.GQLTypeKind.BOOLEAN_TYPE) {
      return 'Boolean';
    }
    return 'ID';
  }

  // Utility

  _name = (name:types.SymbolName):string => {
    return name.replace(/\W/g, '_');
  }

  _indent(content:string|string[]):string {
    if (!_.isArray(content)) content = content.split('\n');
    return content.map(s => `  ${s}`).join('\n');
  }
}
