# ts2gql

Binds all methods on an object to itself, _including_ those defined on its prototype, and inherited up the chain.  Also ensures that any methods' properties are preserved.

```js
import autobind from 'ts2gql';

class Foo {
  constructor() {
    autobind(this);
  }

  foo() {
    return 'stuff';
  }

  bar() {
    return this.foo();
  }
}

const bar = new Foo().bar;
bar(); // 'stuff'
```

You can also use it as a decorator:

```js
import autobind from 'ts2gql';

@autobind
class Foo {
  foo() {
    return 'stuff';
  }

  bar() {
    return this.foo();
  }
}

const bar = new Foo().bar;
bar(); // 'stuff'
```
