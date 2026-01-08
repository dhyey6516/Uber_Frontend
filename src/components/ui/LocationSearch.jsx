import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, User, Plus, MapPin, ChevronDown } from 'lucide-react';
import { api } from '../../utils/api';
import { getCurrentLocation } from '../../utils/location';

const LocationSearch = ({ onBack, onComplete }) => {
    const [pickup, setPickup] = useState('');
    const [destination, setDestination] = useState('');
    const [activeInput, setActiveInput] = useState('destination'); // 'pickup' or 'destination'
    const [suggestions, setSuggestions] = useState([]);
    const [userLocation, setUserLocation] = useState(null);

    const pickupDebounceRef = useRef(null);
    const destinationDebounceRef = useRef(null);

    useEffect(() => {
        // Get user location for better suggestions and auto-fill pickup
        const fetchLocation = async () => {
            try {
                const coords = await getCurrentLocation();
                const { latitude, longitude } = coords;
                setUserLocation([latitude, longitude]);

                try {
                    // Attempt to reverse geocode to fill pickup box
                    const res = await api.getReverseGeocode(latitude, longitude);
                    if (res && res.address) {
                        setPickup(res.address);
                    } else {
                        // Fallback if no specific address returned
                        setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    }
                } catch (error) {
                    console.error('Reverse geocode failed:', error);
                    // Fallback
                    setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                }
            } catch (error) {
                console.error('Error getting location:', error);
            }
        };

        fetchLocation();
    }, []);

    const fetchSuggestions = async (input) => {
        if (input.length < 3) {
            setSuggestions([]);
            return;
        }
        try {
            const locationStr = userLocation ? `${userLocation[0]},${userLocation[1]}` : null;
            const res = await api.getAutoComplete(input, locationStr);
            if (res.predictions) {
                setSuggestions(res.predictions);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    const handlePickupChange = (e) => {
        const value = e.target.value;
        setPickup(value);
        setActiveInput('pickup');

        if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
        pickupDebounceRef.current = setTimeout(() => fetchSuggestions(value), 500);
    };

    const handleDestinationChange = (e) => {
        const value = e.target.value;
        setDestination(value);
        setActiveInput('destination');

        if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
        destinationDebounceRef.current = setTimeout(() => fetchSuggestions(value), 500);
    };

    const [pickupSuggestion, setPickupSuggestion] = useState(null);
    const [destSuggestion, setDestSuggestion] = useState(null);

    const handleSuggestionClick = (suggestion) => {
        const address = `${suggestion.name}, ${suggestion.address}`;
        let newPickup = pickup;
        let newDestination = destination;
        let newPickupDesc = pickupSuggestion;
        let newDestDesc = destSuggestion;

        if (activeInput === 'pickup') {
            setPickup(address);
            setPickupSuggestion(suggestion);
            newPickup = address;
            newPickupDesc = suggestion;
        } else {
            setDestination(address);
            setDestSuggestion(suggestion);
            newDestination = address;
            newDestDesc = suggestion;
        }

        // Check if we can complete the selection
        if (newPickup && newDestination) {
            onComplete(newPickup, newDestination, newPickupDesc, newDestDesc);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 flex items-center shadow-sm bg-white z-10">
                <button onClick={onBack} className="p-2 mr-2">
                    <ArrowLeft size={24} className="text-black" />
                </button>
                <div className="flex-1 text-center pr-10"> {/* pr-10 balances the back button width roughly */}
                    <h1 className="text-lg font-semibold text-black">Plan your trip</h1>
                </div>
            </div>

            {/* Pills */}
            <div className="flex gap-3 px-4 py-4">
                <button className="flex items-center gap-2 bg-gray-100 px-4 py-1.5 rounded-full text-sm font-medium text-black">
                    <Clock size={16} className="text-gray-900" />
                    <span>Pick-up now</span>
                    <ChevronDown size={14} className="text-gray-600" />
                </button>
                <button className="flex items-center gap-2 bg-gray-100 px-4 py-1.5 rounded-full text-sm font-medium text-black">
                    <User size={16} className="text-gray-900" />
                    <span>For me</span>
                    <ChevronDown size={14} className="text-gray-600" />
                </button>
            </div>

            {/* Inputs Section */}
            <div className="px-4">
                <div className="relative flex items-center gap-4">
                    {/* Timeline Visual */}
                    <div className="absolute left-4 top-8 bottom-8 flex flex-col items-center justify-between pointer-events-none z-10 w-4">
                        <div className="w-2.5 h-2.5 bg-gray-300 rounded-full"></div>
                        <div className="w-0.5 flex-1 bg-gray-300 my-1"></div>
                        <div className="w-2.5 h-2.5 bg-black border-[3px] border-black"></div>
                        {/* Note: The image has a hollow circle or icon for top, square for bottom. 
                            Adjusting to match: Top usually circle, bottom square.
                            The user image has a pin-like icon on top and square on bottom. 
                        */}
                    </div>

                    <div className="flex-1 flex flex-col gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Pick-up location"
                                value={pickup}
                                onChange={handlePickupChange}
                                onFocus={() => setActiveInput('pickup')}
                                className="w-full bg-gray-100 p-3 pl-10 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Where to?"
                                value={destination}
                                onChange={handleDestinationChange}
                                onFocus={() => setActiveInput('destination')}
                                autoFocus
                                className="w-full bg-gray-100 p-3 pl-10 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>
                    </div>

                    {/* Plus Button */}
                    <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-black flex-shrink-0">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-y-auto mt-6">
                {/* Use mocked recent item if no suggestions yet, or just list suggestions */}
                {suggestions.length === 0 ? (
                    <div className="px-4">
                        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Saved Places</h3>
                        <div className="flex items-center gap-4 py-3 border-b border-gray-100">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <MapPin size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900">Set location on map</h4>
                                <p className="text-sm text-gray-500">Choose on map</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="px-4">
                        {suggestions.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => handleSuggestionClick(item)}
                                className="flex items-center gap-4 py-3 border-b border-gray-100 cursor-pointer"
                            >
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <MapPin size={20} className="text-gray-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                                    <p className="text-sm text-gray-500 line-clamp-1">{item.address}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationSearch;
