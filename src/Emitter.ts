import * as _ from 'lodash';

import * as Types from './types';
import { ReferenceNode } from './types';

// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
export default class Emitter {
  renames:{[key:string]:string} = {};

  constructor(private types:Types.TypeMap) {
    this.types = <Types.TypeMap>_.omitBy(types, (node, name) => this._preprocessNode(node, name!));
  }

  emitAll(stream:NodeJS.WritableStream) {
    stream.write('\n');
    _.each(this.types, (node, name) => this.emitTopLevelNode(node, name!, stream));
  }

  emitTopLevelNode(node:Types.Node, name:Types.SymbolName, stream:NodeJS.WritableStream) {
    let content;
    if (node.type === 'alias') {
      content = this._emitAlias(node, name);
    } else if (node.type === 'interface') {
      content = this._emitInterface(node, name);
    } else if (node.type === 'enum') {
      content = this._emitEnum(node, name);
    } else {
      throw new Error(`Don't know how to emit ${node.type} as a top level node`);
    }
    stream.write(`${content}\n\n`);
  }

  // Preprocessing

  _preprocessNode(node:Types.Node, name:Types.SymbolName):boolean {
    if (node.type === 'alias' && node.target.type === 'reference') {
      const referencedNode = this.types[node.target.target];
      if (this._isPrimitive(referencedNode) || referencedNode.type === 'enum') {
        this.renames[name] = node.target.target;
        return true;
      }
    } else if (node.type === 'alias' && this._hasDocTag(node, 'ID')) {
      this.renames[name] = 'ID';
      return true;
    }

    return false;
  }

  // Nodes

  _emitAlias(node:Types.AliasNode, name:Types.SymbolName):string {
    if (this._isPrimitive(node.target)) {
      return `scalar ${this._name(name)}`;
    } else if (node.target.type === 'reference') {
      return `union ${this._name(name)} = ${this._name(node.target.target)}`;
    } else if (node.target.type === 'union') {
      return this._emitUnion(node.target, name);
    } else {
      throw new Error(`Can't serialize ${JSON.stringify(node.target)} as an alias`);
    }
  }

  _emitUnion(node:Types.UnionNode, name:Types.SymbolName):string {
    if (_.every(node.types, entry => entry.type === 'string literal')) {
      const nodeValues = node.types.map((type:Types.StringLiteralNode) => type.value);
      return this._emitEnum({
        type: 'enum',
        values: _.uniq(nodeValues),
      }, this._name(name));
    }

    node.types.map(type => {
      if (type.type !== 'reference') {
        throw new Error(`GraphQL unions require that all types are references. Got a ${type.type}`);
      }
    });

    const firstChild = node.types[0] as ReferenceNode;
    const firstChildType = this.types[firstChild.target];
    if (firstChildType.type === 'enum') {
      const nodeTypes = node.types.map((type:ReferenceNode) => {
        const subNode = this.types[type.target];
        if (subNode.type !== 'enum') {
          throw new Error(`ts2gql expected a union of only enums since first child is an enum. Got a ${type.type}`);
        }
        return subNode.values;
      });
      return this._emitEnum({
        type: 'enum',
        values: _.uniq(_.flatten(nodeTypes)),
      }, this._name(name));
    } else if (firstChildType.type === 'interface') {
      const nodeNames = node.types.map((type:ReferenceNode) => {
        const subNode = this.types[type.target];
        if (subNode.type !== 'interface') {
          throw new Error(`ts2gql expected a union of only interfaces since first child is an interface. ` +
            `Got a ${type.type}`);
        }
        return type.target;
      });
      return `union ${this._name(name)} = ${nodeNames.join(' | ')}`;
    } else {
      throw new Error(`ts2gql currently does not support unions for type: ${firstChildType.type}`);
    }
  }

  _emitInterface(node:Types.InterfaceNode, name:Types.SymbolName):string {
    // GraphQL expects denormalized type interfaces
    const members = <Types.Node[]>_(this._transitiveInterfaces(node))
      .map(i => i.members)
      .flatten()
      .uniqBy('name')
      .sortBy('name')
      .value();

    // GraphQL can't handle empty types or interfaces, but we also don't want
    // to remove all references (complicated).
    if (!members.length) {
      members.push({
        type: 'property',
        name: '_placeholder',
        signature: {type: 'boolean'},
      });
    }

    const properties = _.map(members, (member) => {
      if (member.type === 'method') {
        let parameters = '';
        if (_.size(member.parameters) > 1) {
          throw new Error(`Methods can have a maximum of 1 argument`);
        } else if (_.size(member.parameters) === 1) {
          let argType = _.values(member.parameters)[0] as Types.Node;
          if (argType.type === 'reference') {
            argType = this.types[argType.target];
          }
          parameters = `(${this._emitExpression(argType)})`;
        }
        const returnType = this._emitExpression(member.returns);
        return `${this._name(member.name)}${parameters}: ${returnType}`;
      } else if (member.type === 'property') {
        return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
      } else {
        throw new Error(`Can't serialize ${member.type} as a property of an interface`);
      }
    });

    if (this._getDocTag(node, 'schema')) {
      return `schema {\n${this._indent(properties)}\n}`;
    } else if (this._getDocTag(node, 'input')) {
      return `input ${this._name(name)} {\n${this._indent(properties)}\n}`;
    }

    if (node.concrete) {
      // If tagged with a "key" graphql tag, add the @key annotation for federation
      const federationDecorator = this._getDocTags(node, 'key')
        .map(tag => `@key(fields: "${tag.substring(4)}") `)
        .join('');
      return `type ${this._name(name)} ${federationDecorator}{\n${this._indent(properties)}\n}`;
    }

    let result = `interface ${this._name(name)} {\n${this._indent(properties)}\n}`;
    const fragmentDeclaration = this._getDocTag(node, 'fragment');
    if (fragmentDeclaration) {
      result = `${result}\n\n${fragmentDeclaration} {\n${this._indent(members.map((m:any) => m.name))}\n}`;
    }

    return result;
  }

  _emitEnum(node:Types.EnumNode, name:Types.SymbolName):string {
    return `enum ${this._name(name)} {\n${this._indent(node.values)}\n}`;
  }

  _emitExpression = (node:Types.Node):string => {
    if (!node) {
      return '';
    } else if (node.type === 'string') {
      return 'String'; // TODO: ID annotation
    } else if (node.type === 'number') {
      return 'Float'; // TODO: Int/Float annotation
    } else if (node.type === 'boolean') {
      return 'Boolean';
    } else if (node.type === 'reference') {
      return this._name(node.target);
    } else if (node.type === 'array') {
      return `[${node.elements.map(this._emitExpression).join(' | ')}]`;
    } else if (node.type === 'literal object' || node.type === 'interface') {
      return _(this._collectMembers(node))
        .map((member:Types.PropertyNode) => {
          return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
        })
        .join(', ');
    } else {
      throw new Error(`Can't serialize ${node.type} as an expression`);
    }
  }

  _collectMembers = (node:Types.InterfaceNode|Types.LiteralObjectNode):Types.PropertyNode[] => {
    let members:Types.Node[] = [];
    if (node.type === 'literal object') {
      members = node.members;
    } else {
      const seenProps = new Set<Types.SymbolName>();
      let interfaceNode:Types.InterfaceNode|null;
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
          const supertype:Types.Node = this.types[interfaceNode.inherits[0]];
          if (supertype.type !== 'interface') {
            throw new Error(`Expected supertype to be an interface node: ${supertype}`);
          }
          interfaceNode = supertype;
        } else {
          interfaceNode = null;
        }
      }
    }

    for (const member of members) {
      if (member.type !== 'property') {
        throw new Error(`Expected members to be properties; got ${member.type}`);
      }
    }
    return members as Types.PropertyNode[];
  }

  // Utility

  _name = (name:Types.SymbolName):string => {
    name = this.renames[name] || name;
    return name.replace(/\W/g, '_');
  }

  _isPrimitive(node:Types.Node):boolean {
    return node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'any';
  }

  _indent(content:string|string[]):string {
    if (!_.isArray(content)) content = content.split('\n');
    return content.map(s => `  ${s}`).join('\n');
  }

  _transitiveInterfaces(node:Types.InterfaceNode):Types.InterfaceNode[] {
    let interfaces = [node];
    for (const name of node.inherits) {
      const inherited = <Types.InterfaceNode>this.types[name];
      interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
    }
    return _.uniq(interfaces);
  }

  _hasDocTag(node:Types.ComplexNode, prefix:string):boolean {
    return !!this._getDocTag(node, prefix);
  }

  _getDocTag(node:Types.ComplexNode, prefix:string):string|null {
    if (!node.documentation) return null;
    for (const tag of node.documentation.tags) {
      if (tag.title !== 'graphql') continue;
      if (tag.description.startsWith(prefix)) return tag.description;
    }
    return null;
  }

  // Returns ALL matching tags from the given node.
  _getDocTags(node:Types.ComplexNode, prefix:string):string[] {
    const matchingTags:string[] = [];
    if (!node.documentation) return matchingTags;
    for (const tag of node.documentation.tags) {
      if (tag.title !== 'graphql') continue;
      if (tag.description.startsWith(prefix)) matchingTags.push(tag.description);
    }
    return matchingTags;
  }

}
