/**
 * 节流函数
 * @param {Function} func 待执行函数
 * @param {Number} delay 节流间隔
 * @param {Boolean} trailing 最后一次是否执行
 * @returns 真正执行的函数
 */
export const throttle = (func, delay, trailing) => {
  var delay = delay || 1000;
  var previousDate = new Date();
  var previous = previousDate.getTime(); // 初始化一个时间，也作为高频率事件判断事件间隔的变量，通过闭包进行保存。
  var timer = null;
  return function (args) {
    var context = this;
    var nowDate = new Date();
    var now = nowDate.getTime();
    var remainTime = delay - now + previous;
    if (remainTime <= 0) {
      // 如果本次触发和上次触发的时间间隔超过设定的时间
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      func.call(context, args); // 就执行事件处理函数 （eventHandler）
      previous = now; // 然后将本次的触发时间，作为下次触发事件的参考时间。
      return;
    }
    if (trailing && !timer) {
      timer = setTimeout(() => {
        timer = null;
        func.call(context, args);
      }, remainTime);
    }
  };
};

/**
 * 防抖函数
 * @param {Function} func 待执行函数
 * @param {Number} delay 间隔
 * @param {Boolean} immdiate 是否立即执行
 * @returns 真正执行函数
 */
export const debounce = (func, delay, immdiate = false) => {
  let timer = null;
  let isInvoke = false;
  function _debounce(...arg) {
    if (timer) clearTimeout(timer);
    if (immdiate && !isInvoke) {
      const result = func.apply(this, arg);
      isInvoke = true;
    } else {
      timer = setTimeout(() => {
        const result = func.apply(this, arg);
        isInvoke = false;
        timer = null;
      }, delay);
    }
  }

  _debounce.cancel = function () {
    if (timer) clearTimeout(timer);
    timer = null;
    isInvoke = false;
  };

  return _debounce;
};

export const str2utf8 = (str) => {
  if (window.TextDecoder) {
    var encoder = new TextEncoder("utf8");
    var bytes = encoder.encode(str);
    var result = "";
    for (var i = 0; i < bytes.length; ++i) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }
  return eval("'" + encodeURI(str).replace(/%/gm, "\\x") + "'");
};

const formatDate = (value = Date.now(), format = "Y-M-D h:m:s") => {
  const formatNumber = (n) => `0${n}`.slice(-2);
  const date = new Date(value);
  const formatList = ["Y", "M", "D", "h", "m", "s"];
  const resultList = [];
  resultList.push(date.getFullYear().toString());
  resultList.push(formatNumber(date.getMonth() + 1));
  resultList.push(formatNumber(date.getDate()));
  resultList.push(formatNumber(date.getHours()));
  resultList.push(formatNumber(date.getMinutes()));
  resultList.push(formatNumber(date.getSeconds()));
  for (let i = 0; i < resultList.length; i++) {
    format = format.replace(formatList[i], resultList[i]);
  }
  return format;
};

export const formateTrendNum = (numStr) => {
  if (!numStr) return "";
  if (isNaN(Number(numStr))) return numStr;
  return Number(numStr / 10000).toFixed(1) + "万";
};

export const formateHotTime = (dateTime) => {
  if(!dateTime) return ''
  const now = Date.now().valueOf();
  let offset = (now-dateTime) / 1000;
  if (offset < 60) {
    return `${parseInt(offset)}秒前`;
  }
  offset /= 60;
  if (offset < 60) {
    return `${parseInt(offset)}分前`;
  }
  offset /= 60;
  if (offset < 24) {
    return `${parseInt(offset)}小时前`;
  }
  offset /= 24;
  if (offset < 3) {
    return `${parseInt(offset)}天前`;
  }
  return formatDate(dateTime);
};
