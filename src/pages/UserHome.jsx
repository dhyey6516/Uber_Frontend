import { ArrowRight } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UberOnboarding() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Logo */}
      <div className="flex justify-center mt-8 mb-12">
        <h1 className="text-white text-5xl font-semibold tracking-tight">Uber</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Person and Car */}
        <div className="relative mb-8">
          <div className="flex items-end gap-4">
            <img src="person_taxi.png" alt="uber car" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-white text-3xl font-semibold text-center mb-8">
          Go anywhere with Uber
        </h2>
      </div>

      {/* Are you a captain? */}
      <div className='flex justify-end mr-4 mb-8'>
          <button onClick={() => navigate('/captain')} className='font-semibold text-lg text-white flex items-center gap-2'>
            Are you a captain dhyey?
          </button>
          <ArrowRight className='w-6 h-6 ml-1 text-white'/>
        </div>

      {/* Bottom Buttons */}
      <div className="grid grid-cols-2 gap-0">
        <div className="bg-white rounded-tr-3xl p-6 flex items-end">
          <button
           onClick={() => navigate('/user/signin')}
           className="w-full bg-black text-white py-4 px-8 rounded-full font-semibold text-lg border-4 border-yellow-400">
            Log in
          </button>
        </div>
        <div className="bg-white rounded-tl-3xl p-6 flex items-end">
          <button 
           onClick={() => navigate('/user/signup')}
           className="w-full bg-black text-white py-4 px-8 rounded-full font-semibold text-lg border-4 border-yellow-400">
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}