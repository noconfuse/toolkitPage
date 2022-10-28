import React from 'react';
import ReactDOM from 'react-dom/client';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Task from './components/Task';
import Notes from './components/Notes';
import Category from './components/Category';
import Address from './components/Address';
import Tags from './components/Tags'
import Landing from './views/Landing'
import User from './components/User'
import Login from './components/Login'
import Register from './components/Register'
import './index.css';
// import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
  <MuiThemeProvider>
    <BrowserRouter path="/">
      <Routes>
        <Route path='/' element={<Landing/>} />
        {/* <Route path='user' element={<User></User>}>
          <Route path='login' element={Login} />
          <Route path='register' element={Register} />
        </Route> */}
        {/* <Route path="home" element={Layout}> */}
          {/* <IndexRoute component={Task}/> */}
          {/* <Route path="notes" component={Notes} />
          <Route path="task" component={Task} />
          <Route path="category" component={Category} />
          <Route path="address" component={Address} />
          <Route path="tags" component={Tags} /> */}
        {/* </Route> */}
      </Routes>
    </BrowserRouter>
  </MuiThemeProvider>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
