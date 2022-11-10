import axiosIns from "./axiosIns";
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


export const getHotRank = (queryType)=>{
    return axiosIns({
        method:"GET",
        url:"rankList",
        params:{
            queryType:queryType
        }
    })
}

// 天气api
export const getWeather = async (options)=>{
    const {page,pageSize ,city} = options;
    const {data} = await axiosIns({
        method:"GET",
        url:`weather`,
        params:{
            city,
            needMoreData:true,
            pageNo:page,
            pageSize
        }
    })

    return data
}