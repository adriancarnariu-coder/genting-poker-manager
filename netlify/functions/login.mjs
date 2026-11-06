export {default} from './gateway.mjs';
export const config={path:['/auth/login','/auth/accept-invite'],preferStatic:false,rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
