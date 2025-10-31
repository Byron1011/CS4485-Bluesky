import { Routes, Route, Link } from "react-router-dom";
import { useState } from 'react'
import './App.css'

import Login from "./Login"
import Register from "./Register"
import Protected from "./Protected"


function App() {

  return (
    <div>
      

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/protected" element={<Register />} />
      </Routes>
    </div>
  )
}

export default App
