// import { Router } from '../devices/Router';
// import { RouteEntry, IPAddress, RIPConfig, OSPFConfig } from '../types';
// import { NetworkStack } from './NetworkStack';

// // RIP (Routing Information Protocol) Implementation
// export class RIPProtocol {
//   private routers: Map<string, Router> = new Map();
//   private updateInterval: number = 30000; // 30 seconds
//   private timer: NodeJS.Timeout | null = null;

//   constructor() {
//     this.startUpdateTimer();
//   }

//   addRouter(router: Router): void {
//     this.routers.set(router.id, router);
//   }

//   removeRouter(routerId: string): void {
//     this.routers.delete(routerId);
//   }

//   private startUpdateTimer(): void {
//     this.timer = setInterval(() => {
//       this.sendUpdates();
//     }, this.updateInterval);
//   }

//   private sendUpdates(): void {
//     for (const router of this.routers.values()) {
//       this.sendRIPUpdate(router);
//     }
//   }

//   private sendRIPUpdate(router: Router): void {
//     const routingTable = router.showRoutingTable();
    
//     // Send updates to all neighboring routers
//     router.interfaces.forEach(iface => {
//       if (iface.isUp && iface.connectedTo) {
//         const neighborId = this.getNeighborRouterId(iface.connectedTo);
//         if (neighborId) {
//           const neighbor = this.routers.get(neighborId);
//           if (neighbor) {
//             this.processRIPUpdate(neighbor, routingTable, router.id);
//           }
//         }
//       }
//     });
//   }

//   private processRIPUpdate(receiver: Router, routes: RouteEntry[], senderId: string): void {
//     let routingChanged = false;

//     routes.forEach(route => {
//       if (route.protocol === 'rip' || route.protocol === 'static') {
//         // Calculate new metric (add 1 for hop count)
//         const newMetric = route.metric + 1;
        
//         // Don't accept routes with metric >= 16 (infinity in RIP)
//         if (newMetric >= 16) return;

//         // Check if we have a better route
//         const existingRoutes = receiver.showRoutingTable();
//         const existingRoute = existingRoutes.find(r => 
//           r.destinationNetwork.address === route.destinationNetwork.address &&
//           r.subnetMask === route.subnetMask
//         );

//         if (!existingRoute || existingRoute.metric > newMetric) {
//           // Add or update route
//           const senderInterface = this.findInterfaceToSender(receiver, senderId);
//           if (senderInterface) {
//             receiver.addRoute(
//               route.destinationNetwork,
//               route.subnetMask,
//               { address: this.getSenderIP(senderId, senderInterface), subnet: '' },
//               senderInterface,
//               newMetric,
//               'rip'
//             );
//             routingChanged = true;
//           }
//         }
//       }
//     });

//     if (routingChanged) {
//       console.log(`RIP: ${receiver.name} updated routing table from ${senderId}`);
//     }
//   }

//   private getNeighborRouterId(connectedInterface: string): string | null {
//     // Parse connected interface format: "deviceId-interfaceName"
//     return connectedInterface.split('-')[0];
//   }

//   private findInterfaceToSender(receiver: Router, senderId: string): string | null {
//     for (const iface of receiver.interfaces) {
//       if (iface.connectedTo && iface.connectedTo.startsWith(senderId)) {
//         return iface.name;
//       }
//     }
//     return null;
//   }

//   private getSenderIP(senderId: string, receiverInterface: string): string {
//     const sender = this.routers.get(senderId);
//     if (sender) {
//       // Find the interface connected to the receiver
//       const senderInterface = sender.interfaces.find(iface => 
//         iface.connectedTo && iface.connectedTo.includes(receiverInterface)
//       );
//       return senderInterface?.ipAddress?.address || '0.0.0.0';
//     }
//     return '0.0.0.0';
//   }

//   stop(): void {
//     if (this.timer) {
//       clearInterval(this.timer);
//       this.timer = null;
//     }
//   }
// }

// // OSPF (Open Shortest Path First) Implementation - Simplified
// export class OSPFProtocol {
//   private routers: Map<string, Router> = new Map();
//   private lsdb: Map<string, LSA> = new Map(); // Link State Database
//   private spfTimer: NodeJS.Timeout | null = null;

//   constructor() {
//     this.startSPFTimer();
//   }

//   addRouter(router: Router): void {
//     this.routers.set(router.id, router);
//     this.generateLSA(router);
//   }

//   removeRouter(routerId: string): void {
//     this.routers.delete(routerId);
//     this.lsdb.delete(routerId);
//   }

//   private startSPFTimer(): void {
//     // Run SPF algorithm every 10 seconds
//     this.spfTimer = setInterval(() => {
//       this.runSPF();
//     }, 10000);
//   }

//   private generateLSA(router: Router): void {
//     const links: OSPFLink[] = [];
    
//     router.interfaces.forEach(iface => {
//       if (iface.isUp && iface.ipAddress) {
//         const link: OSPFLink = {
//           linkId: iface.connectedTo || 'stub',
//           linkData: iface.ipAddress.address,
//           type: iface.connectedTo ? 'point-to-point' : 'stub',
//           metric: 1,
//         };
//         links.push(link);
//       }
//     });

//     const lsa: LSA = {
//       routerId: router.id,
//       sequenceNumber: Date.now(),
//       age: 0,
//       links,
//     };

//     this.lsdb.set(router.id, lsa);
//     this.floodLSA(lsa, router.id);
//   }

//   private floodLSA(lsa: LSA, originatorId: string): void {
//     // Flood LSA to all routers except originator
//     for (const [routerId, router] of this.routers.entries()) {
//       if (routerId !== originatorId) {
//         this.receiveLSA(router, lsa);
//       }
//     }
//   }

//   private receiveLSA(router: Router, lsa: LSA): void {
//     const existingLSA = this.lsdb.get(lsa.routerId);
    
//     if (!existingLSA || lsa.sequenceNumber > existingLSA.sequenceNumber) {
//       this.lsdb.set(lsa.routerId, lsa);
//       console.log(`OSPF: ${router.name} received LSA from ${lsa.routerId}`);
      
//       // Trigger SPF calculation
//       this.calculateSPF(router);
//     }
//   }

//   private runSPF(): void {
//     for (const router of this.routers.values()) {
//       this.calculateSPF(router);
//     }
//   }

//   private calculateSPF(router: Router): void {
//     // Dijkstra's algorithm implementation
//     const distances: Map<string, number> = new Map();
//     const previous: Map<string, string> = new Map();
//     const unvisited: Set<string> = new Set();

//     // Initialize distances
//     for (const lsa of this.lsdb.values()) {
//       distances.set(lsa.routerId, lsa.routerId === router.id ? 0 : Infinity);
//       unvisited.add(lsa.routerId);
//     }

//     while (unvisited.size > 0) {
//       // Find unvisited node with minimum distance
//       let currentNode = '';
//       let minDistance = Infinity;
      
//       for (const node of unvisited) {
//         const distance = distances.get(node) || Infinity;
//         if (distance < minDistance) {
//           minDistance = distance;
//           currentNode = node;
//         }
//       }

//       if (currentNode === '' || minDistance === Infinity) break;
      
//       unvisited.delete(currentNode);
      
//       // Update distances to neighbors
//       const currentLSA = this.lsdb.get(currentNode);
//       if (currentLSA) {
//         currentLSA.links.forEach(link => {
//           if (link.type === 'point-to-point' && link.linkId !== 'stub') {
//             const neighborId = link.linkId.split('-')[0];
//             const currentDistance = distances.get(currentNode) || Infinity;
//             const newDistance = currentDistance + link.metric;
//             const neighborDistance = distances.get(neighborId) || Infinity;
            
//             if (newDistance < neighborDistance) {
//               distances.set(neighborId, newDistance);
//               previous.set(neighborId, currentNode);
//             }
//           }
//         });
//       }
//     }

//     // Install routes based on SPF results
//     this.installOSPFRoutes(router, distances, previous);
//   }

//   private installOSPFRoutes(router: Router, distances: Map<string, number>, previous: Map<string, string>): void {
//     for (const [destinationId, distance] of distances.entries()) {
//       if (destinationId !== router.id && distance < Infinity) {
//         const destination = this.routers.get(destinationId);
//         if (destination) {
//           // Find next hop
//           let nextHop = destinationId;
//           while (previous.has(nextHop) && previous.get(nextHop) !== router.id) {
//             nextHop = previous.get(nextHop)!;
//           }
          
//           // Find next hop IP and interface
//           const nextHopRouter = this.routers.get(nextHop);
//           if (nextHopRouter) {
//             const nextHopInterface = this.findConnectedInterface(router, nextHopRouter);
//             if (nextHopInterface) {
//               // Install route for each network the destination router is connected to
//               destination.interfaces.forEach(destIface => {
//                 if (destIface.ipAddress) {
//                   const network = NetworkStack.calculateNetworkAddress(
//                     destIface.ipAddress.address,
//                     destIface.ipAddress.subnet
//                   );
                  
//                   router.addRoute(
//                     { address: network, subnet: destIface.ipAddress.subnet },
//                     destIface.ipAddress.subnet,
//                     { address: nextHopInterface.ip, subnet: '' },
//                     nextHopInterface.interfaceName,
//                     distance,
//                     'ospf'
//                   );
//                 }
//               });
//             }
//           }
//         }
//       }
//     }
//   }

//   private findConnectedInterface(router1: Router, router2: Router): { ip: string; interfaceName: string } | null {
//     for (const iface of router1.interfaces) {
//       if (iface.connectedTo && iface.connectedTo.startsWith(router2.id)) {
//         return {
//           ip: router2.interfaces.find(r2iface => 
//             r2iface.connectedTo && r2iface.connectedTo.startsWith(router1.id)
//           )?.ipAddress?.address || '0.0.0.0',
//           interfaceName: iface.name
//         };
//       }
//     }
//     return null;
//   }

//   stop(): void {
//     if (this.spfTimer) {
//       clearInterval(this.spfTimer);
//       this.spfTimer = null;
//     }
//   }
// }

// // OSPF Data Structures
// interface LSA {
//   routerId: string;
//   sequenceNumber: number;
//   age: number;
//   links: OSPFLink[];
// }

// interface OSPFLink {
//   linkId: string;
//   linkData: string;
//   type: 'point-to-point' | 'transit' | 'stub';
//   metric: number;
// }

// // Static Routing Helper
// export class StaticRoutingHelper {
//   static configureDefaultRoute(router: Router, gatewayIP: string, interfaceName: string): void {
//     router.addRoute(
//       { address: '0.0.0.0', subnet: '0.0.0.0' },
//       '0.0.0.0',
//       { address: gatewayIP, subnet: '' },
//       interfaceName,
//       1,
//       'static'
//     );
//   }

//   static configureNetworkRoute(
//     router: Router,
//     network: string,
//     subnetMask: string,
//     nextHop: string,
//     interfaceName: string,
//     metric: number = 1
//   ): void {
//     router.addRoute(
//       { address: network, subnet: subnetMask },
//       subnetMask,
//       { address: nextHop, subnet: '' },
//       interfaceName,
//       metric,
//       'static'
//     );
//   }

//   static calculateRoutingTable(
//     sourceRouter: Router,
//     allRouters: Router[]
//   ): RouteEntry[] {
//     const routes: RouteEntry[] = [];
    
//     // Add connected routes
//     sourceRouter.interfaces.forEach(iface => {
//       if (iface.ipAddress) {
//         const network = NetworkStack.calculateNetworkAddress(
//           iface.ipAddress.address,
//           iface.ipAddress.subnet
//         );
        
//         routes.push({
//           destinationNetwork: { address: network, subnet: iface.ipAddress.subnet },
//           subnetMask: iface.ipAddress.subnet,
//           nextHop: { address: '0.0.0.0', subnet: '' },
//           interface: iface.name,
//           metric: 0,
//           protocol: 'connected'
//         });
//       }
//     });

//     return routes;
//   }
// }