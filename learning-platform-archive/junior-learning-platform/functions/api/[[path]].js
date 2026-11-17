import { handleApi } from '../../src/api.mjs';
export const onRequest = context => handleApi(context.request,context.env);
