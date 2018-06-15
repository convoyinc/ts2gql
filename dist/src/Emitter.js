"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
// tslint:disable-next-line
// https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png
var Emitter = /** @class */ (function () {
    function Emitter(types) {
        var _this = this;
        this.types = types;
        this.renames = {};
        this._emitExpression = function (node) {
            if (!node) {
                return '';
            }
            else if (node.type === 'string') {
                return 'String'; // TODO: ID annotation
            }
            else if (node.type === 'number') {
                return 'Float'; // TODO: Int/Float annotation
            }
            else if (node.type === 'boolean') {
                return 'Boolean';
            }
            else if (node.type === 'reference') {
                return _this._name(node.target);
            }
            else if (node.type === 'array') {
                return "[" + node.elements.map(_this._emitExpression).join(' | ') + "]";
            }
            else if (node.type === 'literal object' || node.type === 'interface') {
                return _(_this._collectMembers(node))
                    .map(function (member) {
                    return _this._name(member.name) + ": " + _this._emitExpression(member.signature);
                })
                    .join(', ');
            }
            else if (node.type === 'alias') {
                throw new Error();
            }
            else {
                throw new Error("Can't serialize " + node.type + " as an expression");
            }
        };
        this._collectMembers = function (node) {
            var e_1, _a, e_2, _b;
            var members = [];
            if (node.type === 'literal object') {
                members = node.members;
            }
            else {
                var seenProps = new Set();
                var interfaceNode = void 0;
                interfaceNode = node;
                // loop through this interface and any super-interfaces
                while (interfaceNode) {
                    try {
                        for (var _c = __values(interfaceNode.members), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var member = _d.value;
                            if (seenProps.has(member.name))
                                continue;
                            seenProps.add(member.name);
                            members.push(member);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    if (interfaceNode.inherits.length > 1) {
                        throw new Error("No support for multiple inheritence: " + JSON.stringify(interfaceNode.inherits));
                    }
                    else if (interfaceNode.inherits.length === 1) {
                        var supertype = _this.types[interfaceNode.inherits[0]];
                        if (supertype.type !== 'interface') {
                            throw new Error("Expected supertype to be an interface node: " + supertype);
                        }
                        interfaceNode = supertype;
                    }
                    else {
                        interfaceNode = null;
                    }
                }
            }
            try {
                for (var members_1 = __values(members), members_1_1 = members_1.next(); !members_1_1.done; members_1_1 = members_1.next()) {
                    var member = members_1_1.value;
                    if (member.type !== 'property') {
                        throw new Error("Expected members to be properties; got " + member.type);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (members_1_1 && !members_1_1.done && (_b = members_1.return)) _b.call(members_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return members;
        };
        // Utility
        this._name = function (name) {
            name = _this.renames[name] || name;
            return name.replace(/\W/g, '_');
        };
        this.types = _.omitBy(types, function (node, name) { return _this._preprocessNode(node, name); });
    }
    Emitter.prototype.emitAll = function (stream) {
        var _this = this;
        stream.write('\n');
        _.each(this.types, function (node, name) { return _this.emitTopLevelNode(node, name, stream); });
    };
    Emitter.prototype.emitTopLevelNode = function (node, name, stream) {
        var content;
        if (node.type === 'alias') {
            content = this._emitAlias(node, name);
        }
        else if (node.type === 'interface') {
            content = this._emitInterface(node, name);
        }
        else if (node.type === 'enum') {
            content = this._emitEnum(node, name);
        }
        else {
            throw new Error("Don't know how to emit " + node.type + " as a top level node");
        }
        stream.write(content + "\n\n");
    };
    // Preprocessing
    Emitter.prototype._preprocessNode = function (node, name) {
        if (node.type === 'alias' && node.target.type === 'reference') {
            var referencedNode = this.types[node.target.target];
            if (this._isPrimitive(referencedNode) || referencedNode.type === 'enum') {
                this.renames[name] = node.target.target;
                return true;
            }
        }
        else if (node.type === 'alias' && this._hasDocTag(node, 'ID')) {
            this.renames[name] = 'ID';
            return true;
        }
        return false;
    };
    // Nodes
    Emitter.prototype._emitAlias = function (node, name) {
        if (this._isPrimitive(node.target)) {
            return "scalar " + this._name(name);
        }
        else if (node.target.type === 'reference') {
            return "union " + this._name(name) + " = " + this._name(node.target.target);
        }
        else if (node.target.type === 'union') {
            return this._emitUnion(node.target, name);
        }
        else {
            throw new Error("Can't serialize " + circularJSONStringify(node.target) + " as an alias");
        }
    };
    Emitter.prototype._emitUnion = function (node, name) {
        var _this = this;
        node.types.map(function (type) {
            if (type.type !== 'reference') {
                throw new Error("GraphQL unions require that all types are references. Got a " + type.type);
            }
        });
        var firstChild = node.types[0];
        var firstChildType = this.types[firstChild.target];
        if (firstChildType.type === 'enum') {
            var nodeTypes = node.types.map(function (type) {
                var subNode = _this.types[type.target];
                if (subNode.type !== 'enum') {
                    throw new Error("ts2gql expected a union of only enums since first child is an enum. Got a " + type.type);
                }
                return subNode.values;
            });
            return this._emitEnum({
                type: 'enum',
                values: _.uniq(_.flatten(nodeTypes)),
            }, this._name(name));
        }
        else if (firstChildType.type === 'interface') {
            var nodeNames = node.types.map(function (type) {
                var subNode = _this.types[type.target];
                if (subNode.type !== 'interface') {
                    throw new Error("ts2gql expected a union of only interfaces since first child is an interface. " +
                        ("Got a " + type.type));
                }
                return type.target;
            });
            return "union " + this._name(name) + " = " + nodeNames.join(' | ');
        }
        else {
            throw new Error("ts2gql currently does not support unions for type: " + firstChildType.type);
        }
    };
    Emitter.prototype._emitInterface = function (node, name) {
        var _this = this;
        // GraphQL expects denormalized type interfaces
        var members = _(this._transitiveInterfaces(node))
            .map(function (i) { return i.members; })
            .flatten()
            .uniqBy('name')
            .sortBy('name')
            .reject(_.isEmpty)
            .value();
        // GraphQL can't handle empty types or interfaces, but we also don't want
        // to remove all references (complicated).
        if (!members.length) {
            members.push({
                type: 'property',
                name: '__placeholder',
                signature: { type: 'boolean' },
            });
        }
        var properties = _.map(members, function (member) {
            if (member.type === 'method') {
                var parameters = '';
                if (_.size(member.parameters) > 1) {
                    throw new Error("Methods can have a maximum of 1 argument");
                }
                else if (_.size(member.parameters) === 1) {
                    var parameter = _.first(_.values(member.parameters));
                    var argType = parameter;
                    if (argType.type === 'reference') {
                        argType = _this.types[argType.target];
                        if (argType.type === 'alias' && argType.target.type === 'union') {
                            return _this._name(member.name) + "(" + _this._name(parameter.target) + ")";
                        }
                    }
                    parameters = "(" + _this._emitExpression(argType) + ")";
                }
                var returnType = _this._emitExpression(member.returns);
                return "" + _this._name(member.name) + parameters + ": " + returnType;
            }
            else if (member.type === 'property') {
                return _this._name(member.name) + ": " + _this._emitExpression(member.signature);
            }
            else {
                throw new Error("Can't serialize " + member.type + " as a property of an interface");
            }
        });
        if (this._getDocTag(node, 'schema')) {
            return "schema {\n" + this._indent(properties) + "\n}";
        }
        else if (this._getDocTag(node, 'input')) {
            return "input " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        }
        if (node.concrete) {
            return "type " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        }
        var result = "interface " + this._name(name) + " {\n" + this._indent(properties) + "\n}";
        var fragmentDeclaration = this._getDocTag(node, 'fragment');
        if (fragmentDeclaration) {
            result = result + "\n\n" + fragmentDeclaration + " {\n" + this._indent(members.map(function (m) { return m.name; })) + "\n}";
        }
        return result;
    };
    Emitter.prototype._emitEnum = function (node, name) {
        return "enum " + this._name(name) + " {\n" + this._indent(node.values) + "\n}";
    };
    Emitter.prototype._isPrimitive = function (node) {
        return node.type === 'string' || node.type === 'number' || node.type === 'boolean';
    };
    Emitter.prototype._indent = function (content) {
        if (!_.isArray(content))
            content = content.split('\n');
        return content.map(function (s) { return "  " + s; }).join('\n');
    };
    Emitter.prototype._transitiveInterfaces = function (node) {
        var e_3, _a;
        var interfaces = [node];
        try {
            for (var _b = __values(node.inherits), _c = _b.next(); !_c.done; _c = _b.next()) {
                var name = _c.value;
                var inherited = this.types[name];
                interfaces = interfaces.concat(this._transitiveInterfaces(inherited));
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return _.uniq(interfaces);
    };
    Emitter.prototype._hasDocTag = function (node, prefix) {
        return !!this._getDocTag(node, prefix);
    };
    Emitter.prototype._getDocTag = function (node, prefix) {
        var e_4, _a;
        if (!node.documentation)
            return null;
        try {
            for (var _b = __values(node.documentation.tags), _c = _b.next(); !_c.done; _c = _b.next()) {
                var tag = _c.value;
                if (tag.title !== 'graphql')
                    continue;
                if (tag.description.startsWith(prefix))
                    return tag.description;
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return null;
    };
    return Emitter;
}());
exports.default = Emitter;
function circularJSONStringify(obj) {
    var cache = [];
    var result = JSON.stringify(obj, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    }, 2);
    cache.length = 0;
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9FbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDBCQUE0QjtBQUs1QiwyQkFBMkI7QUFDM0IsbUlBQW1JO0FBQ25JO0lBR0UsaUJBQW9CLEtBQW1CO1FBQXZDLGlCQUVDO1FBRm1CLFVBQUssR0FBTCxLQUFLLENBQWM7UUFGdkMsWUFBTyxHQUF5QixFQUFFLENBQUM7UUFnS25DLG9CQUFlLEdBQUcsVUFBQyxJQUFlO1lBQ2hDLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLENBQUM7YUFDWDtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNqQyxPQUFPLFFBQVEsQ0FBQyxDQUFDLHNCQUFzQjthQUN4QztpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO2dCQUNqQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLDZCQUE2QjthQUM5QztpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUNsQyxPQUFPLFNBQVMsQ0FBQzthQUNsQjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFO2dCQUNwQyxPQUFPLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ2hDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7Z0JBQ2hDLE9BQU8sTUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFHLENBQUM7YUFDbkU7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLGdCQUFnQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFO2dCQUN0RSxPQUFPLENBQUMs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