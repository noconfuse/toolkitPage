import TranslateEngine from "./baiduTranslate";
import { jsonp } from "./request";

export const fetchSuggestions = (searchStr)=>{
    const now = Date.now().valueOf();
    return new Promise(resolve=>{
        jsonp('https://www.baidu.com/sugrec',{
                prod:"pc",
                _:now,
                wd:searchStr
        },'cb',resolve)
    })
}


export const translateText = (textStr,options={})=>{
    const {domain,from,to} = options
    return TranslateEngine.Instance().translate({
        textStr,
        from,
        to,
        domain
    })
}

export const distinguish = (textStr)=>{
    return TranslateEngine.Instance().distinguish({textStr})
}