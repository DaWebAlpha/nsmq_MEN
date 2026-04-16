
const autoCatchFn = (fn) => {
    return function (request, response, next){
        Promise.resolve(fn(request, response, next)).catch(next);
    }
}

export { autoCatchFn };
export default autoCatchFn;
