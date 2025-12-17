// src/pages/Home.jsx
import React from 'react'
import HeroSection from '../components/HeroSection'
import FeaturedSection from '../components/FeaturedSection'
import TrailersSection from '../components/TrailersSection'

const Home = () => {
  return (
    <main className="min-h-screen text-white relative overflow-hidden bg-[#08090d]">

      {/* Global Cinematic Gradient Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* Left Cinematic Glow */}
        <div className="absolute top-[-200px] left-[-150px] h-[550px] w-[550px] 
          bg-[#ff3b5c29] blur-[150px] rounded-full" />

        {/* Right Purple Spotlight */}
        <div className="absolute bottom-[-180px] right-[-120px] h-[500px] w-[500px] 
          bg-[#6a0dad38] blur-[170px] rounded-full" />

        {/* Center Soft Blend */}
        <div className="absolute inset-0 
          bg-gradient-to-b from-transparent via-[#090a0f33] to-[#090a0f]" />
      </div>

      <HeroSection />
      <FeaturedSection />
      <TrailersSection />
    </main>
  )
}

export default Home