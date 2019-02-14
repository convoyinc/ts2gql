import * as _ from 'lodash';
import * as types from './types';
import * as util from './util';
import { CollectorType } from './Collector';

// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
export default class Emitter {
  private typeMap:types.TypeDefinitionMap;
  private root:types.SchemaDefinitionNode;
  private emissionMap:Map<types.SymbolName, string> = new Map();
  private emissionQueue:types.SymbolName[] = [];
  constructor(collector:CollectorType) {
    this.typeMap = collector.types;
    if (!collector.root) {
      throw new Error(`Empty schema definition.`);
    }
    this.root = collector.root;
  }

  emitAll(stream:NodeJS.WritableStream) {
    stream.write('\n');
    const query = this.typeMap.get(this.root.query);
    let mutation;
    if (this.root.mutation) {
      mutation = this.typeMap.get(this.root.mutation);
    }

    if (query) {
      const queryRootName = this._name(this.root.query);
      this.emitTopLevelNode(query, queryRootName);
    }

    if (mutation) {
      const mutationRootName = this._name(this.root.mutation!);
      this.emitTopLevelNode(mutation, mutationRootName);
    }
    console.log(this.emissionQueue)
    this.emissionQueue.forEach(emissionElem => stream.write(`${this.emissionMap.get(emissionElem)!}\n`));
    stream.write(`${this.emitSchema()}\n`);
  }

  emitTopLevelNode(node:types.TypeDefinitionNode, name:types.SymbolName) {
    if (this.emissionMap.has(name)) {
      return;
    }
    if (node.kind !== types.GQLDefinitionKind.DEFINITION_ALIAS) {
      this.emissionQueue.push(name);
      this.emissionMap.set(name, '');
    }
    const description = this._emitDescription(node.description);
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
        const aliased = this.typeMap.get(node.target)!;
        content = this.emitTopLevelNode(aliased, name);
        return;
      default:
        throw new Error(`Unsupported top level node '${name}'.`);
    }
    this.emissionMap.set(name, description + content);
  }

  emitSchema() {
    const properties = `query: ${this._name(this.root.query)}`
    + (this.root.mutation ? `\nmutation: ${this._name(this.root.mutation)}` : '');
    return `schema {\n${this._indent(properties)}\n}`;
  }

  // Specialized emitters

  _emitDescription(desc:string|undefined):string {
    return desc ? `"""\n${desc}\n"""\n` : '';
  }

  _emitObject(node:types.ObjectTypeDefinitionNode, name:string):string {
    let emittedImplements = this._emitImplementations(node);
    if (emittedImplements) {
      emittedImplements = ' ' + emittedImplements;
    }
    return `type ${this._name(name)}${emittedImplements} {\n${this._emitFields(node.fields)}\n}`;
  }

  _emitImplementations(node:types.ObjectTypeDefinitionNode):string {
    const implemented = node.implements.filter(reference => {
      const referenced = this.typeMap.get(reference.target);
      if (!referenced) {
        return false;
      }
      this.emitTopLevelNode(referenced, this._name(reference.target));
      return referenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION;
    }).map(reference => this._name(reference.target));
    if (implemented.length === 0) {
      return '';
    }
    return `implements ${implemented.join(' & ')}`;
  }

  _emitInterface(node:types.InterfaceTypeDefinitionNode, name:types.SymbolName):string {
    return `interface ${this._name(name)} {\n${this._emitFields(node.fields)}\n}`;
  }

  _emitFields(fields:types.FieldDefinitionNode[]) {
    const emitted = fields.map(field => this._emitField(field));
    return emitted.join('\n');
  }

  _emitField(field:types.FieldDefinitionNode) {
    const description = this._emitDescription(field.description);
    const argumentList = this._emitArguments(field.arguments);
    let directives = this._emitFieldDirectives(field.directives);
    if (directives) {
      directives = ' ' + directives;
    }
    return this._indent(description
    + `${this._name(field.name)}${argumentList}: ${this._emitExpression(field.type)}${directives}`);
  }

  _emitArguments(args?:(types.InputValueDefinitionNode | types.DirectiveInputValueNode)[]):string {
    return args && args.length > 0 ? `(${args.map(this._emitInputValue).join(', ')})` : '';
  }

  _emitInputValue = (node:types.InputValueDefinitionNode | types.DirectiveInputValueNode):string => {
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
    return `enum ${this._name(name)} {\n${this._emitEnumFields(node.fields)}\n}`;
  }

  _emitEnumFields(fields:types.EnumFieldDefinitionNode[]):string {
    return fields.map(field => this._indent(this._emitDescription(field.description) + field.name)).join('\n');
  }

  _emitUnion(node:types.UnionTypeDefinitionNode, name:types.SymbolName):string {
    const nodeNames = node.members.map(member => this._emitExpression(member));
    return `union ${this._name(name)} = ${nodeNames.join(' | ')}`;
  }

  _emitScalarDefinition(node:types.ScalarTypeDefinitionNode, name:types.SymbolName):string {
    return node.builtIn ? '' : `scalar ${this._name(name)}`;
  }

  _emitExpression = (node:types.TypeNode|types.ValueNode):string => {
    if (node.kind === types.GQLTypeKind.VALUE) {
      return `${node.value}`;
    }
    const required = node.nullable ? '' : '!';
    let emitted = '';
    if (util.isReferenceType(node)) {
      const referenceName = this._name(node.target);
      this.emitTopLevelNode(this.typeMap.get(referenceName)!, referenceName);
      emitted = referenceName;
    } else if (node.kind === types.GQLTypeKind.LIST_TYPE) {
      emitted = `[${this._emitExpression(node.wrapped)}]`;
    } else if (node.kind === types.GQLTypeKind.STRING_TYPE) {
      emitted = 'String';
    } else if (node.kind === types.GQLTypeKind.FLOAT_TYPE) {
      emitted = 'Float';
    } else if (node.kind === types.GQLTypeKind.INT_TYPE) {
      emitted = 'Int';
    } else if (node.kind === types.GQLTypeKind.BOOLEAN_TYPE) {
      emitted = 'Boolean';
    } else if (node.kind === types.GQLTypeKind.ID_TYPE) {
      emitted = 'ID';
    }

    return emitted + required;
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
