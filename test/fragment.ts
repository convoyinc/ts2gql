import { fragment } from '../dist';
import { Post, User } from './input';
import 'graphql-tag';

interface AuthorProps {
  author:Pick<User, 'name' | 'photo'>;
}

interface DateTimeProps {
  post:Pick<Post, 'postedAt'>;
}

type PostProps =
  // When current component directly displays properties of the entity
  Pick<Post, 'id' | 'title'> &
  // When passing the entire entity to another component
  DateTimeProps['post'] &
  // Passing a prop of the entity to another component
  {
    author:AuthorProps['author'];
  } &
  // When current component displays deep properties of an entity
  {
    editor:{
      name:User['name'],
    },
  };

const query = `
  query getPosts() {
    posts() {
      ...${fragment<PostProps, Post>(require('../graphql/getPosts.graphql'))}
    }
  }
`;
