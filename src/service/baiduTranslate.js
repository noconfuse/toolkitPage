import md5 from "md5";
// import { str2utf8 } from "../utils";
import { jsonp } from "./request";

const AppId = "20221031001426879";
const AppKey = "8MCfFomLjSQ8IypaSLPS";



class TranslateEngine{
    url = 'https://fanyi-api.baidu.com/api/trans/vip/fieldtranslate';
    url1 = 'https://fanyi-api.baidu.com/api/trans/vip/language'
    static instance =null;

    static Instance(){
        if(!TranslateEngine.instance){
            TranslateEngine.instance = new TranslateEngine();
        }
        return TranslateEngine.instance
    }

    generateSign(query,salt,domain){
        // query = str2utf8(query);
        let signStr = AppId + query + salt;
        if(domain){
            signStr += domain;
        }
        signStr += AppKey;
        return md5(signStr);
    }

    translate(params){
        const {textStr,from,to,domain} = params;
        const salt = new Date().getTime();
        const sign = this.generateSign(textStr,salt,domain);
        return new Promise(resolve=>{
            let params = {
                q:encodeURIComponent(textStr),
                from:from||"auto",
                to:to,
                appid:AppId,
                salt,
                sign
            }
            if(domain){
                params.domain = domain;
            }
            jsonp(this.url,params,'callback',resolve)

        })
    }

    distinguish(params){
        const {textStr} = params;
        const salt = new Date().getTime();
        const sign = this.generateSign(textStr,salt);
        return new Promise(resolve=>{
            jsonp(this.url1,{
                q:encodeURIComponent(textStr),
                appid:AppId,
                salt,
                sign
            },'callback',resolve)
        })
    }
}


export default TranslateEngine;
