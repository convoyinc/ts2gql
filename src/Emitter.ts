import * as _ from 'lodash';
import * as Types from './types';
import * as util from './util';

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
    if (node.type === Types.NodeType.ALIAS) {
      content = this._emitAlias(node, name);
    } else if (node.type === Types.NodeType.INTERFACE) {
      content = this._emitInterface(node, name);
    } else if (node.type === Types.NodeType.ENUM) {
      content = this._emitEnum(node, name);
    } else {
      throw new Error(`Don't know how to emit ${node.type} as a top level node`);
    }
    stream.write(`${content}\n\n`);
  }

  // Preprocessing

  _preprocessNode(node:Types.Node, name:Types.SymbolName):boolean {
    const specialTags = ['ID', 'Int', 'Float'];

    if (node.type === Types.NodeType.ALIAS && node.target.type === Types.NodeType.REFERENCE) {
      const referencedNode = this.types[node.target.target];
      if (util.isPrimitive(referencedNode) || referencedNode.type === Types.NodeType.ENUM) {
        this.renames[name] = node.target.target;
        return true;
      }
    } else if (node.type === Types.NodeType.ALIAS) {
      for (const tag of specialTags) {
        if (this._hasDocTag(node, tag)) {
          this.renames[name] = tag;
          return true;
        }
      }
    }

    return false;
  }

  // Nodes

  _emitAlias(node:Types.AliasNode, name:Types.SymbolName):string {
    const aliasTarget = node.target.type === Types.NodeType.NOT_NULL ? node.target.node : node.target;

    if (util.isPrimitive(aliasTarget)) {
      return this._emitScalarDefinition(name);
    } else if (aliasTarget.type === Types.NodeType.REFERENCE) {
      return `union ${this._name(name)} = ${this._emitReference(aliasTarget)}`;
    } else if (aliasTarget.type === Types.NodeType.UNION) {
      return this._emitUnion(aliasTarget, name);
    } else {
      throw new Error(`Can't serialize ${JSON.stringify(aliasTarget, undefined, 1)} as an alias`);
    }
  }

  _emitScalarDefinition(name:Types.SymbolName):string {
    return `scalar ${this._name(name)}`;
  }

  _emitReference(node:Types.ReferenceNode):string {
    return this._name(node.target);
  }

  _emitUnion(node:Types.UnionNode, name:Types.SymbolName):string {
    if (_.every(node.types, entry => entry.type === Types.NodeType.STRING_LITERAL)) {
      const nodeValues = node.types.map((type:Types.StringLiteralNode) => type.value);
      return this._emitEnum({
        type: Types.NodeType.ENUM,
        values: _.uniq(nodeValues),
      }, this._name(name));
    }

    // Since there is no union of scalars, interpret as a custom Scalar declaration
    if (node.types.length === 1 && util.isPrimitive(node.types[0])) {
      return this._emitScalarDefinition(name);
    }

    const unionNodeTypes = node.types.map((type) => {
      if (type.type !== Types.NodeType.REFERENCE && (type.type !== Types.NodeType.NOT_NULL
        || type.node.type !== Types.NodeType.REFERENCE )) {
        const msg = 'GraphQL unions require that all types are references. Got a '
        + (type.type === Types.NodeType.NOT_NULL ? type.node.type : type.type);
        throw new Error(msg);

      }
      return (type.type === Types.NodeType.REFERENCE ? type : type.node as Types.ReferenceNode);
    });

    const firstChild = unionNodeTypes[0];
    let firstChildType = this.types[firstChild.target];
    if (firstChildType.type === Types.NodeType.ALIAS) {
      firstChildType = util.unwrapNotNull(firstChildType.target);
    }

    if (util.isPrimitive(firstChildType)) {
      throw new Error('GraphQL does not support unions with GraphQL Scalars');
    } else if (firstChildType.type === Types.NodeType.UNION) {
      throw new Error('GraphQL does not support unions with GraphQL Unions');
    } else if (firstChildType.type === Types.NodeType.INTERFACE && !firstChildType.concrete) {
      throw new Error('GraphQL does not support unions with GraphQL Interfaces.');
    } else if (firstChildType.type === Types.NodeType.ENUM) {
      const nodeTypes = unionNodeTypes.map((type:Types.ReferenceNode) => {
        const subNode = this.types[type.target];
        if (subNode.type !== Types.NodeType.ENUM) {
          throw new Error(`ts2gql expected a union of only enums since first child is an enum. Got a ${type.type}`);
        }
        return subNode.values;
      });

      return this._emitEnum({
        type: Types.NodeType.ENUM,
        values: _.uniq(_.flatten(nodeTypes)),
      }, this._name(name));

    } else if (firstChildType.type === Types.NodeType.INTERFACE) {
      const nodeNames = unionNodeTypes.map((type:Types.ReferenceNode) => {

        const subNode = this.types[type.target];
        if (subNode.type !== Types.NodeType.INTERFACE) {
          let error = 'GraphQL expects an union of only Object Types.';
          if (subNode.type === Types.NodeType.ALIAS) {
            const target = util.unwrapNotNull(subNode.target);
            error = error + ` Got a ${target.type}.`;
          }
          throw new Error(error);
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
        type: Types.NodeType.PROPERTY,
        name: '__placeholder',
        signature: {type: Types.NodeType.BOOLEAN},
      });
    }

    // Schema definition has special treatment on non nullable properties
    if (this._hasDocTag(node, 'schema')) {
      return this._emitSchemaDefinition(members);
    }

    const properties = _.map(members, (member) => {
      if (member.type === Types.NodeType.METHOD) {
        return this._emitInterfaceMethod(member);
      } else if (member.type === Types.NodeType.PROPERTY) {
        return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
      } else {
        throw new Error(`Can't serialize ${member.type} as a property of an interface`);
      }
    });

    if (this._getDocTag(node, 'input')) {
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

  _emitInterfaceMethod(member:Types.MethodNode):string {
    const parameters = `(${this._emitMethodArgs(member.parameters)})`;
    const returnType = this._emitExpression(member.returns);
    const methodDirectives = this._emitMethodDirectives(member.directives);
    return `${this._name(member.name)}${parameters}: ${returnType} ${methodDirectives}`;
  }

  _emitMethodArgs(node:Types.MethodParamsNode):string {
    return _.map(node.args, (argValue:Types.Node, argName:string) => {
      return `${this._name(argName)}: ${this._emitExpression(argValue)}`;
    }).join(', ');
  }

  _emitMethodDirectives(directives:Types.DirectiveNode[]):string {
    return _.map(directives, (directive:Types.DirectiveNode) => {
      const methodArgs = this._emitMethodArgs(directive.params);
      if (!methodArgs) {
        return `@${directive.name}`;
      }
      return `@${directive.name}(${methodArgs})`;
    }).join(' ');
  }

  _emitEnum(node:Types.EnumNode, name:Types.SymbolName):string {
    return `enum ${this._name(name)} {\n${this._indent(node.values)}\n}`;
  }

  _emitExpression = (node:Types.Node):string => {
    if (!node) {
      return '';
    } else if (node.type === Types.NodeType.VALUE) {
      return `${node.value}`;
    } else if (node.type === Types.NodeType.NOT_NULL) {
      return `${this._emitExpression(node.node)}!`;
    } else if (node.type === Types.NodeType.STRING) {
      return 'String'; // TODO: ID annotation
    } else if (node.type === Types.NodeType.NUMBER) {
      return 'Float'; // TODO: Int/Float annotation
    } else if (node.type === Types.NodeType.BOOLEAN) {
      return 'Boolean';
    } else if (node.type === Types.NodeType.REFERENCE) {
      return this._name(node.target);
    } else if (node.type === Types.NodeType.ARRAY) {
      return `[${node.elements.map(this._emitExpression).join(' | ')}]`;
    } else if (node.type === Types.NodeType.LITERAL_OBJECT || node.type === Types.NodeType.INTERFACE) {
      return _(this._collectMembers(node))
        .map((member:Types.PropertyNode) => {
          return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
        })
        .join(', ');
    } else if (node.type === Types.NodeType.UNION) {
      if (node.types.length !== 1) {
        throw new Error(`There's no support for inline union with non-null and non-undefined types.`);
      }
      return this._emitExpression(node.types[0]);
    } else {
      throw new Error(`Can't serialize ${node.type} as an expression`);
    }
  }

  _collectMembers = (node:Types.InterfaceNode|Types.LiteralObjectNode):Types.PropertyNode[] => {
    let members:Types.Node[] = [];
    if (node.type === Types.NodeType.LITERAL_OBJECT) {
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
          if (supertype.type !== Types.NodeType.INTERFACE) {
            throw new Error(`Expected supertype to be an interface node: ${supertype}`);
          }
          interfaceNode = supertype;
        } else {
          interfaceNode = null;
        }
      }
    }

    for (const member of members) {
      if (member.type !== Types.NodeType.PROPERTY) {
        throw new Error(`Expected members to be properties; got ${member.type}`);
      }
    }
    return members as Types.PropertyNode[];
  }

  _emitSchemaDefinition(members:Types.Node[]):string {
    const properties = _.map(members, (member) => {
      if (member.type !== Types.NodeType.PROPERTY) {
        throw new Error(`Can't serialize ${member.type} as a property of an schema definition`);
      }
      const propertySignature = member.signature;
        // Properties of the schema declaration should not contain ! marks
        if (propertySignature.type === Types.NodeType.NOT_NULL) {
          member.signature = propertySignature.node;
        }
        return `${this._name(member.name)}: ${this._emitExpression(member.signature)}`;
    });

    return `schema {\n${this._indent(properties)}\n}`;
  }

  // Utility

  _name = (name:Types.SymbolName):string => {
    name = this.renames[name] || name;
    return name.replace(/\W/g, '_');
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

}
