export type User = {
  id: string;
  name: string;
  role: 'technician' | 'manager';
};

// Stub implementation for task 1. Task 3 swaps this for Auth.js v5 session reads.
// Every server action and route handler should call this — never inline an id.
export async function currentUser(): Promise<User> {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Dev Technician',
    role: 'technician',
  };
}
