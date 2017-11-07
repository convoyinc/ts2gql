import * as _ from 'lodash';

import * as types from './types';

// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
export default class Emitter {
  renames:{[key:string]:string} = {};

  constructor(private types:types.TypeMap) {
    this.types = <types.TypeMap>_.omitBy(types, (node, name) => this._preprocessNode(node, name!));
  }

  emitAll(stream:NodeJS.WritableStream) {
    stream.write('\n');
    _.each(this.types, (node, name) => this.emitTopLevelNode(node, name!, stream));
  }

  emitTopLevelNode(node:types.Node, name:types.SymbolName, stream:NodeJS.WritableStream) {
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

  _preprocessNode(node:types.Node, name:types.SymbolName):boolean {
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

  _emitAlias(node:types.AliasNode, name:types.SymbolName):string {
    if (this._isPrimitive(node.target)) {
      return `scalar ${this._name(name)}`;
    } else if (node.target.type === 'reference') {
      return `union ${this._name(name)} = ${this._name(node.target.target)}`;
    } else if (node.target.type === 'union') {
      const types = node.target.types.map(type => {
        if (type.type !== 'reference') {
          throw new Error(`GraphQL unions require that all types are references.  Got a ${type.type}`);
        }
        const subNode = this.types[type.target];
        if (subNode.type !== 'enum') {
          throw new Error(`ts2gql currently does not support unions for type: ${subNode.type}`);
        }
        return subNode.values;
      });
      return this._emitEnum({
        type: 'enum',
        values: _.uniq(_.flatten(types)),
      }, this._name(name));
    } else {
      throw new Error(`Can't serialize ${JSON.stringify(node.target)} as an alias`);
    }
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
        type: 'property',
        name: '__placeholder',
        signature: {type: 'boolean'},
      });
    }

    const properties = _.map(members, (member) => {
      if (member.type === 'method') {
        let parameters = '';
        if (_.size(member.parameters) > 1) {
          throw new Error(`Methods can have a maximum of 1 argument`);
        } else if (_.size(member.parameters) === 1) {
          let argType = _.values(member.parameters)[0] as types.Node;
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
      return `type ${this._name(name)} {\n${this._indent(properties)}\n}`;
    }

    let result = `interface ${this._name(name)} {\n${this._indent(properties)}\n}`;
    const fragmentDeclaration = this._getDocTag(node, 'fragment');
    if (fragmentDeclaration) {
      result = `${result}\n\n${fragmentDeclaration} {\n${this._indent(members.map((m:any) => m.name))}\n}`;
    }

    return result;
  }

  _emitEnum(node:types.EnumNode, name:types.SymbolName):string {
    return `enum ${this._name(name)} {\n${this._indent(node.values)}\n}`;
  }

  _emitExpression = (node:types.Node):string => {
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
        .map((member:types.PropertyNode) => {
          return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
        })
        .join(', ');
    } else {
      throw new Error(`Can't serialize ${node.type} as an expression`);
    }
  }

  _collectMembers = (node:types.InterfaceNode|types.LiteralObjectNode):types.PropertyNode[] => {
    let members:types.Node[] = [];
    if (node.type === 'literal object') {
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
          const supertype:types.Node = this.types[interfaceNode.inherits[0]];
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
    return members as types.PropertyNode[];
  }

  // Utility

  _name = (name:types.SymbolName):string => {
    name = this.renames[name] || name;
    return name.replace(/\W/g, '_');
  }

  _isPrimitive(node:types.Node):boolean {
    return node.type === 'string' || node.type === 'number' || node.type === 'boolean';
  }

  _indent(content:string|string[]):string {
    if (!_.isArray(content)) content = content.split('\n');
    return content.map(s => `  ${s}`).join('\n');
  }

  _transitiveInterfaces(node:types.InterfaceNode):types.InterfaceNode[] {
    let interfaces = [node];
    for (const name of node.inherits) {
      const inherited = <types.InterfaceNode>this.types[name];
      interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
    }
    return _.uniq(interfaces);
  }

  _hasDocTag(node:types.ComplexNode, prefix:string):boolean {
    return !!this._getDocTag(node, prefix);
  }

  _getDocTag(node:types.ComplexNode, prefix:string):string|null {
    if (!node.documentation) return null;
    for (const tag of node.documentation.tags) {
      if (tag.title !== 'graphql') continue;
      if (tag.description.startsWith(prefix)) return tag.description;
    }
    return null;
  }

}
