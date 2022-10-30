export const jsonp = (url,param={},paramName,callback)=>{
    if(typeof url != 'string'){
        throw new Error('url必须为字符串')
    }
    url += '?'
    // 将param转为&拼接
    for(let key in param){
        url += `&${key}=${param[key]}`
    }
    //函数名需要加工(保持的函数名的唯一)
    let callbackName = 'fn' + Date.now() + Math.ceil(Math.random()*10)
    //加给对应的window
    window[callbackName] = callback
    //将参数名和回调函数名传入
    url += `&${paramName}=${callbackName}`
    //创建一个script标签
    let script = document.createElement('script')
    //指定对应的src地址
    script.src = url
    //加给body
    document.body.appendChild(script)
    //script标签加载完毕
    script.onload = function(){
        this.remove() //将script标签删除
        delete window[callbackName] //将对应的属性删除
    }
}