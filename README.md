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

export interface QueryRoot {
  users(args: {id: Id}): User[]
  posts(args: {id: Id, authorId: Id, categoryId: Id}): Post[]
  categories(args: {id: Id}): Category[]
}

export interface MutationRoot {
  login(args: {username: string, password: string}): QueryRoot;
}
```

```
> ts2gql input.ts QueryRoot MutationRoot

scalar Date

scalar Id

scalar Url

type User {
  id: Id
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
  id: Id
  postedAt: Date
  title: String
}

type Category {
  id: Id
  name: String
  posts: [Post]
}

type QueryRoot {
  categories(id: Id): [Category]
  posts(id: Id, authorId: Id, categoryId: Id): [Post]
  users(id: Id): [User]
}

type MutationRoot {
  login(username: String, password: String): QueryRoot
}

```
