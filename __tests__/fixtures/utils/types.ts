export type UserType = {
  id: number;
  name: string;
};

export type StatusType = 'active' | 'inactive';

export interface UserInterface {
  id: number;
  name: string;
}

export enum Status {
  Active = 'active',
  Inactive = 'inactive'
}

export namespace UserNamespace {
  export const defaultName = 'John';
}
