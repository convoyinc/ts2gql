import * as _ from 'lodash';

import * as types from './types';

// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
export default class Emitter {
  renames:{[key:string]:string} = {};

  constructor(private types:types.TypeMap) {
    this.types = <types.TypeMap>_.omitBy(types, (node, name) => this._preprocessNode(node, name));
  }

  emitAll(stream:NodeJS.WritableStream) {
    stream.write('\n');
    _.each(this.types, (node, name) => this.emitTopLevelNode(node, name, stream));
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
    } else if (node.type === 'alias' && /@graphql ID/.test(node.documentation)) {
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
        return this._name(type.target);
      });
      return `union ${this._name(name)} = ${types.join(' | ')}`;
    } else {
      throw new Error(`Can't serialize ${JSON.stringify(node.target)} as an alias`);
    }
  }

  _emitInterface(node:types.InterfaceNode, name:types.SymbolName):string {
    const properties = _.map(node.members, (member) => {
      if (member.type === 'method') {
        let parameters = '';
        if (_.size(member.parameters) > 1) {
          throw new Error(`Methods can have a maximum of 1 argument`);
        } else if (_.size(member.parameters) === 1) {
          parameters = `(${this._emitExpression(<types.Node>_.values(member.parameters)[0])})`;
        }
        const returnType = this._emitExpression(member.returns);
        return `${this._name(member.name)}${parameters}: ${returnType}`;
      } else if (member.type === 'property') {
        return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
      } else {
        throw new Error(`Can't serialize ${member.type} as a property of an interface`);
      }
    });

    return `type ${this._name(name)} {\n${this._indent(properties)}\n}`;
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
      return 'Int'; // TODO: Float annotation
    } else if (node.type === 'boolean') {
      return 'Boolean';
    } else if (node.type === 'reference') {
      return this._name(node.target);
    } else if (node.type === 'array') {
      return `[${node.elements.map(this._emitExpression).join(' | ')}]`;
    } else if (node.type === 'literal object') {
      return _(node.members)
        .map((member:types.Node) => {
          if (member.type !== 'property') {
            throw new Error(`Expected members of literal object to be properties; got ${member.type}`);
          }
          return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
        })
        .join(', ');
    } else {
      console.log(node);
      throw new Error(`Can't serialize ${node.type} as an expression`);
    }
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

}
