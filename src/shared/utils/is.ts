function isType(type: string) {
  return function (value: any): boolean {
    return Object.prototype.toString.call(value) === `[object ${type}]`;
  };
}

export const variableType = {
  isObject: isType('Object'),
  isFunction: isType('Function'),
  isArray: isType('Array'),
};

export const isWechat = variableType.isObject(wx) && variableType.isFunction(App);
