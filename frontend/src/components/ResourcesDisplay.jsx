import { useRef, useEffect } from "react";

export default function ResourcesDisplay({ resources }) {

    console.log(resources);

    return (


        <ul className="resource-list">
            {resources.map((res, i) => (
                <li>
                    {res.website && res.website.trim().toUpperCase() != "NOT AVAILABLE" ? (
                        <h2>
                            <a
                                href={res.website}
                            >
                                {res.name}
                            </a>
                        </h2>
                    ) : (
                        <h2>{res.name}</h2>
                    )}


                    {res.address && <div>Address: {res.address} {res.city}, {res.state}</div>}
                    {res.phone && <div>Phone: {res.phone} </div>}
                    {<span>{res.type}</span>}
                    


                </li>
            ))}
        </ul>

    );
};