// components/admin/Title.jsx - Reusable section title component for admin pages
import React from 'react'

const Title = ({ text1, text2 }) => {
  return (
    <h1 className='font-semibold text-3xl tracking-tight'>
      <span className="text-white">{text1} </span>
      <span className="bg-gradient-to-r from-violet-300 to-purple-500 bg-clip-text text-transparent">{text2}</span>
    </h1>
  )
}

export default Title
