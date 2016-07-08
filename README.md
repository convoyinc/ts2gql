# ts2gql

Converts a TypeScript type hierarchy into GraphQL's IDL.

`input.ts`
```ts
/** @graphql ID */
export type Id = string;

export type Url = string;

export interface User {
  id: Id;
  name: string;
  photo: Url;
}

export interface Post {
  id: Id;
  postedAt: Date;
  title: string;
  body: string;
  author: User;
}

export interface Category {
  id: Id;
  name: string;
  posts: Post[];
}

export interface RootQuery {
  users(args: {id: Id}): User[]
  posts(args: {id: Id, authorId: Id, categoryId: Id}): Post[]
  categories(args: {id: Id}): Category[]
}
```

```
> ts2gql input.ts RootQuery

scalar Date

scalar Url

type User {
  id: ID
  name: String
  photo: Url
}

type Post {
  id: ID
  postedAt: Date
  title: String
  body: String
  author: User
}

type Category {
  id: ID
  name: String
  posts: [Post]
}

type RootQuery {
  users(id: ID): [User]
  posts(id: ID, authorId: ID, categoryId: ID): [Post]
  categories(id: ID): [Category]
}

```
