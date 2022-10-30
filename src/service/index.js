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