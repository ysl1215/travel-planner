declare module "hafas-client" {
  export function createClient(profile: any, userAgent: string): any;
}

declare module "hafas-client/p/db/index.js" {
  export const profile: any;
}
