import React from 'react';
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider'
import RaisedButton from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
const style = {
    registerBox:{
        flexGrow:1,
        background:'#fff'
    },
    checkbox:{
        width:'auto'
    },
    labelStyle:{
        fontSize:12,
        width:'auto'
    },
    label:{
        display:"inline-block",
        width:100,
        textAlign:"right"
    },
    snackbar:{
        position:"static",
        transform:'none',
        display:'block',
        background:'rgba(0,0,0,0.5)',
        color:"#8a6d3b",
    },
    snackbarBodyStyle:{
        backgroundColor:"#fcf8e3",
        height:'37px',
        lineHeight:'37px',
        borderRadius:0
    },
    snackbarContentStyle:{
        color:'#8a6d3b'
    }
}
export default class Register extends React.Component{
    constructor(props){
        super(props);
        // P.S: 仅能在构造函数中设置 state
        // 在其他地方绝不能使用 this.state.XXX = XXX
        // 只能使用 this.setState({ XXX: XXX })
        this.state = {
            email:'',
            password:'',
            repassword:'',
            agreeSign:true,
            open:false,
            formValidateInfo:''
        }
    }
    handleChange(e){
        let val = e.target.value;
        switch (e.target.id){
            case 'email':
                this.setState({email:val});
                break;
            case 'password':
                this.setState({password:val});
                break;
            case 'repassword':
                this.setState({repassword:val});
                break;
        }
    }
    handleSubmit(){
        if(!this.state.agreeSign){
            this.setState({
                formValidateInfo : '你没有同意服务条款和隐私条款',
                open : true
            });
            return;
        }
        if(this.state.email.match(/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/)===null){
            this.setState({
                formValidateInfo : '请输入正确的邮箱格式',
                open : true
            });
            return;
        }
        if(this.state.password.length<6){
            this.setState({
                formValidateInfo : '请输入6~18位密码',
                open : true
            });
            return;
        }
        if(this.state.password&&this.state.repassword!==this.state.password){
            this.setState({
                formValidateInfo : '两次输入密码不一致',
                open : true
            });
            return;
        }
        this.refs.register.submit()
    }
    handleRequestClose(){
        this.setState({open:false})
    }
    render(){
        return (
            <div className="hv_center" style={style.registerBox}>
                <form ref='register'
                      action='/home'
                      method='POST'
                      onSubmit={(e)=>{
                          e.preventDefault();
                          this.handleSubmit()
                      }}>
                    <label htmlFor="email" style={style.label}>注册邮箱：</label>
                    <TextField id="email" underlineShow={false} hintText="请输入邮箱" onChange={this.handleChange.bind(this)} required/>
                    <Divider/>
                    <label htmlFor="password" style={style.label}>密码：</label>
                    <TextField id="password" underlineShow={false} hintText="请输入密码" onChange={this.handleChange.bind(this)} required type="password"/>
                    <Divider/>
                    <label htmlFor="repassword" style={style.label}>确认密码：</label>
                    <TextField id="repassword" underlineShow={false} hintText="请再次输入密码" onChange={this.handleChange.bind(this)} required type="password"/>
                    <Divider/>
                    <Snackbar
                        open={this.state.open}
                        message={this.state.formValidateInfo}
                        onRequestClose={this.handleRequestClose.bind(this)}
                        style={style.snackbar}
                        bodyStyle={style.snackbarBodyStyle}
                        contentStyle={style.snackbarContentStyle}
                    />
                    <br/>
                    <div className="flex-between">
                        <Checkbox defaultChecked={this.state.agreeSign} label="我同意服务条款和隐私协议" style={style.checkbox} labelStyle={style.labelStyle}/>
                        
                        </div>
                    <br/>
                    <RaisedButton label="注册" secondary={true} fullWidth={true} type='submit'/>
                </form>
            </div>
        )
    }
}