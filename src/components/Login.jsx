import React from 'react';
import Divider from 'material-ui/Divider'
import TextField from 'material-ui/TextField'
import RaisedButton from 'material-ui/RaisedButton'
const style = {
    loginBox:{
        flexGrow:1,
        background:'#fff'
    }
}
export default class Login extends React.Component{
    constructor(props){
        super(props);
        this.state={
            email:'',
            password:''
        };
        this.handleChange = this.handleChange.bind(this)
    }
    handleChange(e){
        this.setState({
            [e.target.id]:e.target.value
        })
    }
    handleSubmit(){
        console.log(this.state)
    }
    render(){
        return (
            <div className="hv_center" style={style.loginBox}>
                <form onSubmit={(e)=>{
                    e.preventDefault();
                    this.handleSubmit()
                }}>
                    <label htmlFor="email">邮箱：</label>
                    <TextField id="email" underlineShow={false} hintText="输入邮箱" required onChange={this.handleChange}/>
                    <Divider/>
                    <label htmlFor="email">密码：</label>
                    <TextField id="password" underlineShow={false} type="password" hintText="输入密码" required onChange={this.handleChange}/>
                    <Divider/>
                    <br/>
                    {/* <p className="align-right"><Link to="/user/register">木有账号？去注册</Link></p> */}
                    <br/>
                    <RaisedButton label="登录" primary={true} fullWidth={true} type="submit"/>
                </form>
            </div>
        )
    }
}