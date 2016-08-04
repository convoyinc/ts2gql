# ts2gql

Walks a TypeScript type hierarchy and translates it into GraphQL's IDL.

Usage: `ts2gql root/module.ts`

`ts2gql` will load `root/module.ts` (and transitive dependencies), and look for an exported interface annotated with `/** @graphql schema */`, which will become the GraphQL `schema` declaration.  All types referenced by that interface will be converted into GraphQL's IDL.

## Example (and "Docs")

`input.ts`
```ts
// Type aliases become GraphQL scalars.
export type Url = string;

// If you want an explicit GraphQL ID type, you can do that too:
/** @graphql ID */
export type Id = string;

// Interfaces become GraphQL types.
export interface User {
  id: Id;
  name: string;
  photo: Url;
}

export interface PostContent {
  title: string;
  body: string;
}

export interface Post extends PostContent {
  id: Id;
  postedAt: Date;
  author: User;
}

export interface Category {
  id: Id;
  name: string;
  posts: Post[];
}

// Methods are transformed into parameteried edges:
export interface QueryRoot {
  users(args: {id: Id}): User[]
  posts(args: {id: Id, authorId: Id, categoryId: Id}): Post[]
  categories(args: {id: Id}): Category[]
}

export interface MutationRoot {
  login(args: {username: string, password: string}): QueryRoot;
}

// Don't forget to declare your schema and the root types!
/** @graphql schema */
export interface Schema {
  query: QueryRoot;
  mutation: MutationRoot;
}

// If you have input objects (http://docs.apollostack.com/graphql/schemas.html#input-objects)
/** @graphql input */
export interface EmailRecipients {
  type:string
  name:string
  email:Email
}

// You may also wish to expose some GraphQL specific fields or parameterized
// calls on particular types, while still preserving the shape of your
// interfaces for more general use:
/** @graphql override Category */
export interface CategoryOverrides {
  // for example, we may want to be able to filter or paginate posts:
  posts(args: {authorId:Id}): Post[]
}
```

```
> ts2gql input.ts

scalar Date

scalar Url

type User {
  id: ID
  name: String
  photo: Url
}

interface PostContent {
  body: String
  title: String
}

type Post {
  author: User
  body: String
  id: ID
  postedAt: Date
  title: String
}

type Category {
  id: ID
  name: String
  posts(authorId: ID): [Post]
}

type QueryRoot {
  categories(id: ID): [Category]
  posts(id: ID, authorId: ID, categoryId: ID): [Post]
  users(id: ID): [User]
}

type MutationRoot {
  login(username: String, password: String): QueryRoot
}

schema {
  mutation: MutationRoot
  query: QueryRoot
}

```
