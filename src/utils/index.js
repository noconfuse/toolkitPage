

/**
 * 节流函数 
 * @param {Function} func 待执行函数
 * @param {Number} delay 节流间隔
 * @param {Boolean} trailing 最后一次是否执行
 * @returns 真正执行的函数
 */
export  const  throttle = (func, delay,trailing)=>{
    var delay = delay || 1000;
    var previousDate = new Date();
    var previous = previousDate.getTime();  // 初始化一个时间，也作为高频率事件判断事件间隔的变量，通过闭包进行保存。
    var timer = null;
    return function(args) {
        var context = this;
        var nowDate = new Date();
        var now = nowDate.getTime();
        var remainTime = delay - now + previous;
        if (remainTime <= 0) {  // 如果本次触发和上次触发的时间间隔超过设定的时间
            if(timer){
                clearTimeout(timer);
                timer = null;
            }
            func.call(context, args);  // 就执行事件处理函数 （eventHandler）
            previous = now;  // 然后将本次的触发时间，作为下次触发事件的参考时间。
            return;
        }
        if(trailing&&!timer){
            timer = setTimeout(()=>{
                timer = null;
                func.call(context, args);
            },remainTime)
        }
    }
}