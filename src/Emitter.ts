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
        break;
      case types.GQLDefinitionKind.INTERFACE_DEFINITION:
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

  _emitReference(node:types.ReferenceNode):string {
    return this._name(node.target);
  }

  _emitInterface(node:types.InterfaceNode, name:types.SymbolName):string {
    // GraphQL expects denormalized type interfaces
    const members = <types.Node[]>_(this._transitiveInterfaces(node))
      .map(i => i.members)
      .flatten()
      .uniqBy('name')
      .sortBy('name')
      .value();

    // GraphQL can't handle empty types or interfaces, but we also don't want
    // to remove all references (complicated).
    if (!members.length) {
      members.push({
        type: types.GQLTypeKind.PROPERTY,
        name: '__placeholder',
        signature: {type: types.GQLTypeKind.BOOLEAN},
      });
    }

    // Schema definition has special treatment on non nullable properties
    if (this._hasDocTag(node, 'schema')) {
      return this._emitSchemaDefinition(members);
    }

    if (node.concrete) {
      return `type ${this._name(name)} {\n${this._indent(properties)}\n}`;
    }

    let result = `interface ${this._name(name)} {\n${this._indent(properties)}\n}`;

    return result;
  }

  _emitExpression = (node:types.Node):string => {
    if (!node) {
      return '';
    } else if (node.kind === types.GQLTypeKind.VALUE) {
      return `${node.value}`;
    } else if (node.kind === types.GQLTypeKind.NOT_NULL) {
      return `${this._emitExpression(node.node)}!`;
    } else if (node.kind === types.GQLTypeKind.STRING) {
      return 'String'; // TODO: ID annotation
    } else if (node.kind === types.GQLTypeKind.NUMBER) {
      return 'Float'; // TODO: Int/Float annotation
    } else if (node.kind === types.GQLTypeKind.BOOLEAN) {
      return 'Boolean';
    } else if (node.kind === types.GQLTypeKind.REFERENCE) {
      return this._name(node.target);
    } else if (node.kind === types.GQLTypeKind.ARRAY) {
      return `[${node.elements.map(this._emitExpression).join(' | ')}]`;
    } else if (node.kind === types.GQLTypeKind.LITERAL_OBJECT || node.kind === types.GQLTypeKind.INTERFACE) {
      return _(this._collectMembers(node))
        .map((member:types.PropertyNode) => {
          return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
        })
        .join(', ');
    } else if (node.kind === types.GQLTypeKind.UNION) {
      if (node.members.length !== 1) {
        throw new Error(`There's no support for inline union with non-null and non-undefined types.`);
      }
      return this._emitExpression(node.members[0]);
    } else {
      throw new Error(`Can't serialize ${node.kind} as an expression`);
    }
  }

  _collectMembers = (node:types.InterfaceNode|types.LiteralObjectNode):types.PropertyNode[] => {
    let members:types.Node[] = [];
    if (node.kind === types.GQLTypeKind.LITERAL_OBJECT) {
      members = node.members;
    } else {
      const seenProps = new Set<types.SymbolName>();
      let interfaceNode:types.InterfaceNode|null;
      interfaceNode = node;

      // loop through this interface and any super-interfaces
      while (interfaceNode) {
        for (const member of interfaceNode.members) {
          if (seenProps.has(member.name)) continue;
          seenProps.add(member.name);
          members.push(member);
        }
        if (interfaceNode.inherits.length > 1) {
          throw new Error(`No support for multiple inheritence: ${JSON.stringify(interfaceNode.inherits)}`);
        } else if (interfaceNode.inherits.length === 1) {
          const supertype:types.Node = this.typeMap[interfaceNode.inherits[0]];
          if (supertype.kind !== types.GQLTypeKind.INTERFACE) {
            throw new Error(`Expected supertype to be an interface node: ${supertype}`);
          }
          interfaceNode = supertype;
        } else {
          interfaceNode = null;
        }
      }
    }

    for (const member of members) {
      if (member.kind !== types.GQLTypeKind.PROPERTY) {
        throw new Error(`Expected members to be properties; got ${member.kind}`);
      }
    }
    return members as types.PropertyNode[];
  }

  // Utility

  _name = (name:types.SymbolName):string => {
    return name.replace(/\W/g, '_');
  }

  _indent(content:string|string[]):string {
    if (!_.isArray(content)) content = content.split('\n');
    return content.map(s => `  ${s}`).join('\n');
  }

  _transitiveInterfaces(node:types.InterfaceNode):types.InterfaceNode[] {
    let interfaces = [node];
    for (const name of node.inherits) {
      const inherited = <types.InterfaceNode>this.typeMap[name];
      interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
    }
    return _.uniq(interfaces);
  }

}
