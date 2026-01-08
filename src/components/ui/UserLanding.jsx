import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
    Car,
    CarFront,
    Utensils,
    Clock,
    Search,
    ChevronDown,
    Bike,
    Calendar,
    House,
    LayoutGrid,
    FileText,
    User,
    ArrowRight,
    MapPin,
    Key,
    Loader2
} from 'lucide-react'
import LocationSearch from './LocationSearch'
import Fare from './Fare'
import { api } from '../../utils/api'
import { socketManager } from '../../utils/socket'
import { useToast } from '../ui/use-toast'
import { getCurrentLocation } from '../../utils/location'

// Fix for default marker icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to update map center
function MapUpdater({ center, bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length === 2) {
            // Fit map to show both pickup and destination
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center) {
            map.setView(center, map.getZoom());
        }
    }, [center, bounds, map]);
    return null;
}

const UserLanding = () => {
    const [activeTab, setActiveTab] = useState('Rides')
    const [isSearching, setIsSearching] = useState(false)
    const [showFare, setShowFare] = useState(false)
    const [fare, setFare] = useState(null)
    const [pickup, setPickup] = useState(null)
    const [destination, setDestination] = useState(null)
    // Coords for map markers
    const [pickupCoords, setPickupCoords] = useState(null)
    const [destCoords, setDestCoords] = useState(null)
    const [routeCoordinates, setRouteCoordinates] = useState([])
    const [creatingRide, setCreatingRide] = useState(false)
    const [selectedVehicleType, setSelectedVehicleType] = useState(null)
    const [currentRide, setCurrentRide] = useState(null)
    const [searchingCaptain, setSearchingCaptain] = useState(false)
    const [acceptedRide, setAcceptedRide] = useState(null)
    const [captainDetails, setCaptainDetails] = useState(null)
    const [captainLocation, setCaptainLocation] = useState(null)
    const [userLocation, setUserLocation] = useState(null)
    const [otp, setOtp] = useState(null)
    const [otpVerified, setOtpVerified] = useState(false)
    const [nearbyCaptains, setNearbyCaptains] = useState([])
    const [rideCompleted, setRideCompleted] = useState(false)
    const [currentUserLocation, setCurrentUserLocation] = useState(null)
    const navigate = useNavigate()
    const { toast } = useToast()
    const acceptedRideRef = useRef(null)
    const locationUpdateIntervalRef = useRef(null)

    const suggestions = [
        { icon: CarFront, label: 'Ride', promo: false },
        { icon: Bike, label: '2-Wheels', promo: false },
        { icon: Key, label: 'Rental Cars', promo: true },
        { icon: Calendar, label: 'Reserve', promo: false },
    ]

    // Fetch user profile and connect socket
    useEffect(() => {
        if (acceptedRide) return;

        const fetchProfile = async () => {
            try {
                const userData = await api.getProfile();
                if (userData._id) {
                    socketManager.connect(userData._id, 'user');
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
            }
        };

        fetchProfile();

        return () => {
            if (!acceptedRide) {
                socketManager.disconnect();
            }
        };
    }, [acceptedRide]);

    // Socket event listeners
    useEffect(() => {
        const socket = socketManager.getSocket();
        if (socket && socket.connected) {
            const handleRideAccepted = async (data) => {
                console.log('Ride accepted by captain:', data);
                if (data.ride && data.captain) {
                    // Update all states immediately
                    setSearchingCaptain(false);
                    setCreatingRide(false);
                    setAcceptedRide(data.ride);
                    acceptedRideRef.current = data.ride;
                    setCaptainDetails(data.captain);
                    setOtp(data.ride.otp);
                    setFare(null);
                    setNearbyCaptains([]); // Clear nearby captains
                    setRouteCoordinates([]); // Clear previous route, will be set to captain-to-pickup route
                    
                    console.log('State updated - acceptedRide:', data.ride, 'captainDetails:', data.captain);

                    if (data.captain.location && data.captain.location.lat && data.captain.location.lng) {
                        const captainLoc = [data.captain.location.lat, data.captain.location.lng];
                        setCaptainLocation(captainLoc);
                        
                        // Fetch route from captain to user (pickup location)
                        if (userLocation && pickupCoords) {
                            // Route from captain to pickup location
                            await fetchRoute(
                                data.captain.location.lat, 
                                data.captain.location.lng, 
                                pickupCoords[0], 
                                pickupCoords[1]
                            );
                        } else if (userLocation) {
                            // Fallback to user location if pickupCoords not available
                            await fetchRoute(
                                data.captain.location.lat, 
                                data.captain.location.lng, 
                                userLocation[0], 
                                userLocation[1]
                            );
                        }
                    }

                    toast({
                        title: 'Ride Accepted!',
                        description: `${data.captain.fullname?.firstname} has accepted your ride request.`,
                    });
                }
            };

            const handleCaptainLocationUpdate = async (data) => {
                console.log('Captain location updated:', data);
                if (data.location && data.location.lat && data.location.lng) {
                    const captainLoc = [data.location.lat, data.location.lng];
                    setCaptainLocation(captainLoc);
                    
                    // Fetch route from captain to user (pickup location)
                    if (!otpVerified) {
                        if (pickupCoords) {
                            // Route from captain to pickup location
                            await fetchRoute(
                                data.location.lat, 
                                data.location.lng, 
                                pickupCoords[0], 
                                pickupCoords[1]
                            );
                        } else if (userLocation) {
                            // Fallback to user location
                            await fetchRoute(
                                data.location.lat, 
                                data.location.lng, 
                                userLocation[0], 
                                userLocation[1]
                            );
                        }
                    }
                }
            };

            const handleOtpVerified = async (data) => {
                console.log('OTP verified:', data);
                if (data.message === 'OTP Verified' && data.ride) {
                    setOtpVerified(true);
                    setAcceptedRide(data.ride);
                    
                    // Clear previous route (captain to pickup)
                    setRouteCoordinates([]);
                    
                    // Immediately fetch route from current location to destination
                    if (destCoords) {
                        try {
                            const coords = await getCurrentLocation();
                            const { latitude, longitude } = coords;
                            setCurrentUserLocation([latitude, longitude]);
                            await fetchRoute(latitude, longitude, destCoords[0], destCoords[1]);
                        } catch (error) {
                            console.error('Error getting location for route:', error);
                            // Fallback to pickup location
                            if (pickupCoords) {
                                setCurrentUserLocation(pickupCoords);
                                await fetchRoute(pickupCoords[0], pickupCoords[1], destCoords[0], destCoords[1]);
                            }
                        }
                    }
                }
            };

            const handleRideCompleted = (data) => {
                console.log('Ride completed:', data);
                setRideCompleted(true);
                toast({
                    title: 'Ride Completed!',
                    description: 'Your ride has been completed. Redirecting to payment...',
                });
                // Redirect to payments page after 2 seconds
                setTimeout(() => {
                    navigate('/user/payment', { 
                        state: { ride: data.ride || acceptedRide },
                        replace: true 
                    });
                }, 2000);
            };

            socket.on('rideAcceptedToUser', handleRideAccepted);
            socket.on('captain-location-update', handleCaptainLocationUpdate);
            socket.on('otp-verify-response', handleOtpVerified);
            socket.on('end-ride-to-user', handleRideCompleted);

            return () => {
                socket.off('rideAcceptedToUser', handleRideAccepted);
                socket.off('captain-location-update', handleCaptainLocationUpdate);
                socket.off('otp-verify-response', handleOtpVerified);
                socket.off('end-ride-to-user', handleRideCompleted);
            };
        }
    }, [userLocation, otpVerified, toast, navigate, pickupCoords, destCoords]);

    // Get user location
    useEffect(() => {
        if (!userLocation) {
            const fetchLocation = async () => {
                try {
                    const coords = await getCurrentLocation();
                    const { latitude, longitude } = coords;
                    setUserLocation([latitude, longitude]);
                    setCurrentUserLocation([latitude, longitude]);
                } catch (error) {
                    console.error('Error getting location:', error);
                    // Fallback to default location (Delhi)
                    setUserLocation([28.6139, 77.2090]);
                    setCurrentUserLocation([28.6139, 77.2090]);
                }
            };
            fetchLocation();
        }
    }, []);

    // Track user location and update route to destination every 10 seconds when ride is started
    useEffect(() => {
        if (otpVerified && acceptedRide && destCoords) {
            // Update route immediately
            const updateRoute = async () => {
                try {
                    const coords = await getCurrentLocation({
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0,
                    });
                    const { latitude, longitude } = coords;
                    const newLocation = [latitude, longitude];
                    setCurrentUserLocation(newLocation);
                    
                    // Fetch route from current location to destination
                    try {
                        await fetchRoute(latitude, longitude, destCoords[0], destCoords[1]);
                    } catch (err) {
                        console.error('Error updating route:', err);
                        // Fallback: set a simple route if API fails
                        setRouteCoordinates([newLocation, destCoords]);
                    }
                } catch (error) {
                    console.error('Error getting current location:', error);
                    // Fallback: use pickup location if geolocation fails
                    if (pickupCoords) {
                        setCurrentUserLocation(pickupCoords);
                        fetchRoute(pickupCoords[0], pickupCoords[1], destCoords[0], destCoords[1]);
                    }
                }
            };

            // Update immediately
            updateRoute();

            // Set up interval to update every 10 seconds
            locationUpdateIntervalRef.current = setInterval(updateRoute, 10000);

            return () => {
                if (locationUpdateIntervalRef.current) {
                    clearInterval(locationUpdateIntervalRef.current);
                }
            };
        }
    }, [otpVerified, acceptedRide, destCoords, pickupCoords]);

    const handleSearchComplete = async (pickupAddr, destAddr, pickupDesc, destDesc) => {
        setPickup(pickupAddr);
        setDestination(destAddr);
        setIsSearching(false);
        setShowFare(true);

        try {
            let pCoords = pickupDesc && pickupDesc.coordinates ? pickupDesc.coordinates : null;
            let dCoords = destDesc && destDesc.coordinates ? destDesc.coordinates : null;

            // Fetch coordinates if missing
            if (!pCoords) {
                try {
                    const res = await api.getCoordinates(pickupAddr);
                    if (res && res.lat && res.lng) pCoords = { lat: res.lat, lng: res.lng };
                    else if (res && res.coordinates) pCoords = res.coordinates; // Handle potential structure
                } catch (e) { console.error("Failed to fetch pickup coords", e); }
            }

            if (!dCoords) {
                try {
                    const res = await api.getCoordinates(destAddr);
                    if (res && res.lat && res.lng) dCoords = { lat: res.lat, lng: res.lng };
                    else if (res && res.coordinates) dCoords = res.coordinates;
                } catch (e) { console.error("Failed to fetch dest coords", e); }
            }

            // Calculate Fare
            if (pickupAddr && destAddr) {
                const fareData = await api.getFare(pickupAddr, destAddr);
                setFare(fareData);
            }

            if (pCoords && dCoords && pCoords.lat && pCoords.lng && dCoords.lat && dCoords.lng) {
                setPickupCoords([pCoords.lat, pCoords.lng]);
                setDestCoords([dCoords.lat, dCoords.lng]);

                // Fetch route between pickup and destination
                try {
                    const routeData = await api.getRoute(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);

                    if (routeData.geometry && routeData.geometry.coordinates) {
                        const leafletCoords = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        setRouteCoordinates(leafletCoords);
                    } else if (routeData.legs) {
                        // Fallback for OSRM format if different
                        const allCoordinates = [];
                        routeData.legs.forEach(leg => {
                            if (leg.steps) {
                                leg.steps.forEach(step => {
                                    if (step.geometry && step.geometry.coordinates) {
                                        step.geometry.coordinates.forEach(coord => {
                                            allCoordinates.push([coord[1], coord[0]]);
                                        });
                                    }
                                });
                            }
                        });
                        setRouteCoordinates(allCoordinates.length ? allCoordinates : [[pCoords.lat, pCoords.lng], [dCoords.lat, dCoords.lng]]);
                    } else {
                        setRouteCoordinates([[pCoords.lat, pCoords.lng], [dCoords.lat, dCoords.lng]]);
                    }
                } catch (err) {
                    console.error('Error fetching route:', err);
                    setRouteCoordinates([[pCoords.lat, pCoords.lng], [dCoords.lat, dCoords.lng]]);
                }
            } else {
                console.error("Missing coordinates for route", pCoords, dCoords);
            }
        } catch (error) {
            console.error("Error fetching trip details", error);
        }
    }

    const fetchRoute = async (slat, slong, elat, elong) => {
        try {
            const routeData = await api.getRoute(slat, slong, elat, elong);
            if (routeData.geometry && routeData.geometry.coordinates) {
                const coordinates = routeData.geometry.coordinates || [];
                const leafletCoords = coordinates.map(coord => [coord[1], coord[0]]);
                setRouteCoordinates(leafletCoords);
            } else if (routeData.legs) {
                const allCoordinates = [];
                routeData.legs.forEach(leg => {
                    if (leg.steps) {
                        leg.steps.forEach(step => {
                            if (step.geometry && step.geometry.coordinates) {
                                step.geometry.coordinates.forEach(coord => {
                                    allCoordinates.push([coord[1], coord[0]]);
                                });
                            }
                        });
                    }
                });
                if (allCoordinates.length > 0) {
                    setRouteCoordinates(allCoordinates);
                } else {
                    setRouteCoordinates([[slat, slong], [elat, elong]]);
                }
            } else {
                setRouteCoordinates([[slat, slong], [elat, elong]]);
            }
        } catch (err) {
            console.error('Error fetching route:', err);
            setRouteCoordinates([[slat, slong], [elat, elong]]);
        }
    };

    const handleCreateRide = async (vehicleType) => {
        if (!pickup || !destination || creatingRide) return;

        setSelectedVehicleType(vehicleType);
        setCreatingRide(true);

        try {
            const response = await api.createRide(pickup, destination, vehicleType);
            const { ride, captains } = response;

            setCurrentRide(ride);
            setCreatingRide(false);
            setSearchingCaptain(true);

            const socket = socketManager.getSocket();

            if (!socket || !socket.connected) {
                throw new Error('Socket not connected. Please refresh the page.');
            }

            if (captains && captains.length > 0) {
                // Store nearby captains with their locations
                const captainsWithLocations = captains.filter(c => c.location && c.location.lat && c.location.lng);
                setNearbyCaptains(captainsWithLocations);

                captains.forEach((captain) => {
                    if (captain.socketId) {
                        socket.emit('rideRequest', {
                            captainSocketId: captain.socketId,
                            ride: ride,
                        });
                    }
                });

                toast({
                    title: 'Ride Request Sent',
                    description: `Ride request sent to ${captains.length} nearby ${captains.length === 1 ? 'captain' : 'captains'}`,
                });
            } else {
                setSearchingCaptain(false);
                toast({
                    variant: 'destructive',
                    title: 'No Captains Available',
                    description: 'No captains found in the nearby area. Please try again later.',
                });
            }
        } catch (err) {
            console.error('Error creating ride:', err);
            setCreatingRide(false);
            setSearchingCaptain(false);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err.message || 'Failed to create ride. Please try again.',
            });
            setSelectedVehicleType(null);
        }
    };

    if (isSearching) {
        return (
            <LocationSearch
                onBack={() => setIsSearching(false)}
                onComplete={handleSearchComplete}
            />
        )
    }

    if (showFare) {
        return (
            <div className="h-screen w-full relative">
                {/* Header / Back Button for Map View */}
                <div className="absolute top-4 left-4 z-[40]">
                    <button
                        onClick={() => { setShowFare(false); setFare(null); }}
                        className="bg-white p-2 rounded-full shadow-md text-black"
                    >
                        <ArrowRight className="rotate-180" size={24} />
                    </button>
                </div>

                <div className="h-full w-full bg-gray-200 relative z-0">
                    {/* Map */}
                    <MapContainer
                        center={pickupCoords || [28.6139, 77.2090]} // Default New Delhi or user loc
                        zoom={13}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                        zoomControl={false}
                    >
                        {/* Black and White Theme - Similar to Uber */}
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                            className="grayscale"
                        />
                        <MapUpdater 
                            center={
                                otpVerified && currentUserLocation 
                                    ? currentUserLocation 
                                    : acceptedRide && captainLocation 
                                    ? captainLocation 
                                    : (pickupCoords || [28.6139, 77.2090])
                            }
                            bounds={
                                otpVerified && destCoords
                                    ? (currentUserLocation ? [currentUserLocation, destCoords] : (pickupCoords ? [pickupCoords, destCoords] : null))
                                    : acceptedRide && captainLocation && pickupCoords && !otpVerified
                                    ? [captainLocation, pickupCoords] 
                                    : !acceptedRide && pickupCoords && destCoords 
                                    ? [pickupCoords, destCoords] 
                                    : null
                            }
                        />

                        {/* User location marker - show current location when OTP verified, otherwise show initial location */}
                        {(otpVerified && currentUserLocation) ? (
                            <Marker position={currentUserLocation} icon={L.divIcon({
                                className: 'user-marker',
                                html: '<div style="background-color: #000; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            })} />
                        ) : userLocation && (
                            <Marker position={userLocation} icon={L.divIcon({
                                className: 'user-marker',
                                html: '<div style="background-color: #000; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            })} />
                        )}

                        {/* Pickup location marker when ride is accepted but OTP not verified */}
                        {acceptedRide && pickupCoords && !otpVerified && (
                            <Marker position={pickupCoords} icon={L.divIcon({
                                className: 'pickup-marker',
                                html: '<div style="background-color: #000; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            })} />
                        )}

                        {/* Pickup and destination markers */}
                        {!acceptedRide && pickupCoords && <Marker position={pickupCoords} />}
                        {!acceptedRide && destCoords && <Marker position={destCoords} />}
                        
                        {/* Route between pickup and destination */}
                        {!acceptedRide && routeCoordinates.length > 0 && (
                            <Polyline 
                                positions={routeCoordinates} 
                                color="#000" 
                                weight={4}
                                opacity={0.8}
                            />
                        )}

                        {/* Nearby captain locations while searching */}
                        {searchingCaptain && nearbyCaptains.map((captain, index) => (
                            captain.location && captain.location.lat && captain.location.lng && (
                                <Marker 
                                    key={captain._id || index}
                                    position={[captain.location.lat, captain.location.lng]} 
                                    icon={L.divIcon({
                                        className: 'captain-marker',
                                        html: '<div style="background-color: #666; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                        iconSize: [24, 24],
                                        iconAnchor: [12, 12]
                                    })} 
                                />
                            )
                        ))}

                        {/* Accepted captain location marker */}
                        {captainLocation && acceptedRide && (
                            <Marker position={captainLocation} icon={L.divIcon({
                                className: 'car-marker',
                                html: '<div style="background-color: #000; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🚗</div>',
                                iconSize: [30, 30],
                                iconAnchor: [15, 15]
                            })} />
                        )}

                        {/* Route from captain to user/pickup (before OTP verification) */}
                        {routeCoordinates.length > 0 && acceptedRide && captainLocation && !otpVerified && (
                            <Polyline
                                positions={routeCoordinates}
                                color="#000"
                                weight={4}
                                opacity={0.8}
                            />
                        )}

                        {/* Route from current user location to destination (after OTP verification) */}
                        {routeCoordinates.length > 0 && otpVerified && destCoords && (
                            <Polyline
                                positions={routeCoordinates}
                                color="#000"
                                weight={4}
                                opacity={0.8}
                            />
                        )}

                        {/* Destination marker (always show when we have destination) */}
                        {destCoords && (
                            <Marker position={destCoords} icon={L.divIcon({
                                className: 'destination-marker',
                                html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                            })} />
                        )}
                    </MapContainer>
                </div>

                {/* Fare Bottom Sheet - Always show when showFare is true */}
                {!searchingCaptain && !acceptedRide && (
                    <Fare
                        fare={fare}
                        createRide={handleCreateRide}
                        creatingRide={creatingRide}
                        selectedVehicleType={selectedVehicleType}
                    />
                )}

                {/* Searching Captain State */}
                {searchingCaptain && !acceptedRide && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white text-gray-900 z-[100] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.3)] p-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
                            <h3 className="text-xl font-bold mb-2">Searching captain nearby</h3>
                            <p className="text-gray-600 text-sm">Please wait while we find a captain for you...</p>
                        </div>
                    </div>
                )}

                {/* Accepted Ride Info - Only show when OTP not verified */}
                {acceptedRide && !otpVerified && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white text-gray-900 z-[100] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.3)] max-h-[50vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">Your ride</h2>
                                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                    En route
                                </span>
                            </div>

                            {/* Captain Card */}
                            {captainDetails && (
                                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white font-bold">
                                                {captainDetails.fullname?.firstname?.[0]?.toUpperCase() || 'C'}
                                            </div>
                                            <div>
                                                <p className="text-black font-bold">
                                                    {captainDetails.fullname?.firstname || ''} {captainDetails.fullname?.lastname || ''}
                                                </p>
                                                <p className="text-gray-500 text-sm">
                                                    {captainDetails.vehicle?.vehicleType || 'Vehicle'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-black font-bold text-lg">
                                                {captainDetails.vehicle?.plate || 'N/A'}
                                            </p>
                                            <p className="text-gray-500 text-sm">
                                                {captainDetails.vehicle?.color || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {!captainDetails && (
                                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <p className="text-gray-600 text-center">Loading captain details...</p>
                                </div>
                            )}

                            {/* OTP Display */}
                            {otp && (
                                <div className="bg-black text-white rounded-xl p-6 text-center mb-4">
                                    <p className="text-sm mb-2 text-gray-300">Your OTP</p>
                                    <p className="text-5xl font-bold tracking-widest">{otp}</p>
                                    <p className="text-xs mt-2 text-gray-400">Share this code with your driver</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Fullscreen map indicator when ride started - minimal overlay */}
                {otpVerified && acceptedRide && (
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-gray-900 z-[100] rounded-full px-6 py-3 shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-sm font-semibold">Ride in progress</p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white pb-24 text-gray-900">
            {/* Top Tabs */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex w-full">
                    <button
                        onClick={() => setActiveTab('Rides')}
                        className={`flex-1 flex flex-col items-center justify-center py-3 relative ${activeTab === 'Rides' ? 'text-black' : 'text-gray-500'}`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Car size={24} fill={activeTab === 'Rides' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'Rides' ? 0 : 2} />
                            <span className="text-lg font-medium">Rides</span>
                        </div>
                        {activeTab === 'Rides' && (
                            <div className="absolute bottom-0 w-24 h-0.5 bg-black rounded-t-full" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('Eats')}
                        className={`flex-1 flex flex-col items-center justify-center py-3 relative ${activeTab === 'Eats' ? 'text-black' : 'text-gray-500'}`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Utensils size={24} fill={activeTab === 'Eats' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'Eats' ? 0 : 2} />
                            <span className="text-lg font-medium">Eats</span>
                        </div>
                        {activeTab === 'Eats' && (
                            <div className="absolute bottom-0 w-24 h-0.5 bg-black rounded-t-full" />
                        )}
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Search Bar */}
                <div className="relative" onClick={() => setIsSearching(true)}>
                    <div className="bg-[#EFEFEF] rounded-full p-3 pl-12 pr-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-200 transition-colors">
                        <span className="text-xl font-bold text-gray-900">Where to?</span>

                        <div className="bg-white rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                            <Clock size={16} className="text-black fill-current" />
                            <span className="text-sm font-medium">Now</span>
                            <ChevronDown size={14} strokeWidth={3} />
                        </div>
                    </div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900" size={24} strokeWidth={3} />
                </div>

                {/* Recent Destinations */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 border-b border-gray-50/50 pb-2">
                        <div className="bg-gray-200/50 p-2 rounded-full">
                            <Clock size={20} className="text-gray-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">Ironhack GmbH</h3>
                            <p className="text-gray-500 text-sm">Storkower Str. 132, Berlin</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-gray-200/50 p-2 rounded-full">
                            <Clock size={20} className="text-gray-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">Ironhack GmbH</h3>
                            <p className="text-gray-500 text-sm">Storkower Str. 132, Berlin</p>
                        </div>
                    </div>
                </div>

                {/* Suggestions */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-bold text-gray-900">Suggestions</h2>
                        <Link to="#" className="text-gray-900 text-sm font-medium">See All</Link>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {suggestions.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2">
                                <div className="w-full aspect-square bg-[#EFEFEF] rounded-xl flex items-center justify-center relative hover:bg-gray-200 transition-colors cursor-pointer">
                                    {item.promo && (
                                        <div className="absolute -top-2 bg-[#F6F6F6] text-[#048848] text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm border border-gray-100">
                                            Promo
                                        </div>
                                    )}
                                    <item.icon size={32} className="text-black" strokeWidth={1.5} />
                                </div>
                                <span className="text-xs font-medium text-gray-900 text-center leading-tight">
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Easy Car Rentals Banner */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-bold text-gray-900">Easy car rentals</h2>
                    </div>

                    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
                        <div className="min-w-[85%] bg-[#E8F0F5] rounded-xl p-4 relative h-40 overflow-hidden flex-shrink-0">
                            <div className="w-full h-full relative z-10 flex flex-col justify-between">
                                <div className="max-w-[60%]">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">Rent a car and go &rarr;</h3>
                                    <p className="text-sm text-gray-500 leading-tight">Rent for your next business trip</p>
                                </div>
                            </div>

                            {/* Illustration Placeholder */}
                            <div className="absolute inset-0 w-full h-full pointer-events-none">
                                <div className="w-full h-full relative">
                                    {/* Using a simple colored circle and icon as placeholder for the man driving */}
                                    <img
                                        src="https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/d00e4776371683.5c67861304197.png"
                                        alt="Car Rental"
                                        className="w-full h-full object-cover object-center"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="min-w-[85%] bg-[#F5E8E8] rounded-xl p-4 relative h-40 overflow-hidden flex-shrink-0">
                            <div className="w-full h-full relative z-10 flex flex-col justify-between">
                                <div className="max-w-[60%]">
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">Choose your ride &rarr;</h3>
                                    <p className="text-sm text-gray-500 leading-tight">Easily compare types</p>
                                </div>
                            </div>
                            <div className="absolute right-0 bottom-0 w-40 h-full bg-gradient-to-l from-orange-100 to-transparent"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-end z-50">
                <Link to="#" className="flex flex-col items-center gap-1 text-black">
                    <House size={24} fill="currentColor" />
                    <span className="text-[10px] font-medium">Home</span>
                </Link>

                <Link to="#" className="flex flex-col items-center gap-1 text-gray-500">
                    <LayoutGrid size={24} strokeWidth={2} />
                    <span className="text-[10px] font-medium">Services</span>
                </Link>

                <Link to="#" className="flex flex-col items-center gap-1 text-gray-500">
                    <FileText size={24} strokeWidth={2} />
                    <span className="text-[10px] font-medium">Activity</span>
                </Link>

                <Link to="#" className="flex flex-col items-center gap-1 text-gray-500">
                    <User size={24} strokeWidth={2} />
                    <span className="text-[10px] font-medium">Account</span>
                </Link>
            </div>
        </div>
    )
}

export default UserLanding