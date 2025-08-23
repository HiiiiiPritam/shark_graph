'use client';

import { useState } from 'react';
import { FaBook, FaPlay, FaChevronLeft, FaChevronRight, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'theory' | 'hands-on' | 'quiz';
  code?: string;
  diagram?: string;
  quiz?: QuizQuestion[];
  tasks?: Task[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Task {
  description: string;
  hint: string;
  validation: string;
}

const tutorials: Tutorial[] = [
  {
    id: 'networking-basics',
    title: 'Networking Fundamentals',
    description: 'Learn the basics of computer networking, OSI model, and how devices communicate.',
    difficulty: 'beginner',
    estimatedTime: '30 minutes',
    lessons: [
      {
        id: 'osi-model',
        title: 'The OSI Model',
        type: 'theory',
        content: `
# The OSI Model

The **OSI (Open Systems Interconnection) Model** is a conceptual framework that describes how network communication works in seven layers:

## Layer 1: Physical Layer
- **Purpose**: Transmits raw data bits over physical media
- **Examples**: Cables, fiber optics, wireless signals
- **Devices**: Hubs, repeaters, cables

## Layer 2: Data Link Layer
- **Purpose**: Provides reliable data transfer between adjacent nodes
- **Key Concepts**: MAC addresses, frame forwarding, error detection
- **Devices**: Switches, bridges
- **Protocols**: Ethernet, WiFi

## Layer 3: Network Layer
- **Purpose**: Routes packets between different networks
- **Key Concepts**: IP addresses, routing, path determination
- **Devices**: Routers
- **Protocols**: IPv4, IPv6, ICMP

## Layer 4: Transport Layer
- **Purpose**: Provides reliable end-to-end communication
- **Key Concepts**: Ports, flow control, error recovery
- **Protocols**: TCP, UDP

## Layer 5-7: Session, Presentation, Application
- **Purpose**: Handle session management, data formatting, and user applications
- **Examples**: HTTP, HTTPS, FTP, email

Understanding these layers helps you troubleshoot network issues and design better networks.
        `,
      },
      {
        id: 'ip-addressing',
        title: 'IP Addressing',
        type: 'theory',
        content: `
# IP Addressing

**IP addresses** uniquely identify devices on a network. There are two main versions:

## IPv4 Addresses
- **Format**: 32-bit addresses written as four octets (e.g., 192.168.1.100)
- **Range**: Each octet can be 0-255
- **Total**: ~4.3 billion possible addresses

## Subnet Masks
Subnet masks determine which part of an IP address is the network portion and which is the host portion.

**Common Subnet Masks:**
- /24 (255.255.255.0) - 254 hosts per network
- /16 (255.255.0.0) - 65,534 hosts per network  
- /8 (255.0.0.0) - 16,777,214 hosts per network

## Private IP Ranges
These ranges are reserved for private networks:
- **Class A**: 10.0.0.0/8
- **Class B**: 172.16.0.0/12
- **Class C**: 192.168.0.0/16

## CIDR Notation
**CIDR (Classless Inter-Domain Routing)** uses /X notation:
- 192.168.1.0/24 means the first 24 bits are the network portion
- 10.0.0.0/8 means the first 8 bits are the network portion
        `,
      },
      {
        id: 'basic-quiz',
        title: 'Knowledge Check',
        type: 'quiz',
        content: 'Test your understanding of networking basics',
        quiz: [
          {
            question: 'Which layer of the OSI model handles MAC addresses?',
            options: ['Physical', 'Data Link', 'Network', 'Transport'],
            correctAnswer: 1,
            explanation: 'The Data Link layer (Layer 2) handles MAC addresses and frame forwarding between directly connected devices.'
          },
          {
            question: 'What does /24 mean in CIDR notation?',
            options: ['24 hosts', '24 networks', '24 bits for network portion', '24 bits for host portion'],
            correctAnswer: 2,
            explanation: '/24 means the first 24 bits are used for the network portion, leaving 8 bits for host addresses (256 total, 254 usable).'
          },
          {
            question: 'Which device operates at Layer 3?',
            options: ['Hub', 'Switch', 'Router', 'Repeater'],
            correctAnswer: 2,
            explanation: 'Routers operate at Layer 3 (Network layer) and make routing decisions based on IP addresses.'
          }
        ]
      }
    ]
  },
  {
    id: 'switching-fundamentals',
    title: 'Switching and VLANs',
    description: 'Understand how switches work, MAC address learning, and VLAN concepts.',
    difficulty: 'intermediate',
    estimatedTime: '45 minutes',
    lessons: [
      {
        id: 'switch-operation',
        title: 'How Switches Work',
        type: 'theory',
        content: `
# Switch Operation

**Switches** are Layer 2 devices that create separate collision domains for each port.

## MAC Address Learning
1. **Receive Frame**: Switch receives an Ethernet frame on a port
2. **Learn Source**: Records the source MAC address and port in its MAC table
3. **Forward Decision**: Looks up destination MAC in table
4. **Forward or Flood**: 
   - If found: forward to specific port
   - If not found: flood to all ports except incoming

## Frame Processing Steps
\`\`\`
1. Frame arrives on Port 1
2. Source MAC: AA:BB:CC:DD:EE:FF → Learn on Port 1
3. Destination MAC: 11:22:33:44:55:66
4. Look up in MAC table:
   - Found on Port 3 → Forward to Port 3 only
   - Not found → Flood to all ports except Port 1
\`\`\`

## MAC Address Table Aging
- Entries age out after 5 minutes by default
- Prevents table from filling with stale entries
- Dynamic learning adapts to network changes

## Broadcast Handling
- Broadcast frames (FF:FF:FF:FF:FF:FF) are always flooded
- Creates broadcast domain
- All devices in same VLAN receive broadcasts
        `,
      },
      {
        id: 'vlan-concepts',
        title: 'Virtual LANs (VLANs)',
        type: 'theory',
        content: `
# Virtual LANs (VLANs)

**VLANs** logically separate devices on the same physical switch into different broadcast domains.

## Why Use VLANs?
- **Security**: Separate sensitive traffic
- **Performance**: Reduce broadcast traffic
- **Organization**: Group users logically
- **Flexibility**: Easy to reconfigure

## VLAN Types
### Access Ports
- Connects end devices (computers, phones)
- Belongs to one VLAN only
- Removes VLAN tags from outgoing frames

### Trunk Ports
- Connects switches to switches
- Carries multiple VLANs
- Uses 802.1Q tagging to identify VLANs

## 802.1Q VLAN Tagging
\`\`\`
Original Ethernet Frame:
[Dest MAC][Src MAC][Type][Data][FCS]

802.1Q Tagged Frame:
[Dest MAC][Src MAC][VLAN Tag][Type][Data][FCS]
                    ↑
              4 bytes added
\`\`\`

## VLAN Configuration Example
\`\`\`
Switch(config)# vlan 10
Switch(config-vlan)# name Engineering
Switch(config)# interface fa0/1
Switch(config-if)# switchport mode access
Switch(config-if)# switchport access vlan 10
\`\`\`
        `,
      },
      {
        id: 'hands-on-switching',
        title: 'Hands-On: Configure a Switch',
        type: 'hands-on',
        content: 'Practice configuring a switch with VLANs',
        tasks: [
          {
            description: 'Create a new switch in the simulator',
            hint: 'Click the "Add Switch" button',
            validation: 'switch_created'
          },
          {
            description: 'Configure VLAN 10 for Engineering',
            hint: 'Double-click the switch and use the CLI: "vlan 10" then "name Engineering"',
            validation: 'vlan_10_created'
          },
          {
            description: 'Assign port Fa0/1 to VLAN 10',
            hint: 'Use CLI: "interface fa0/1" then "switchport access vlan 10"',
            validation: 'port_assigned_vlan_10'
          }
        ]
      }
    ]
  },
  {
    id: 'routing-protocols',
    title: 'Routing Protocols',
    description: 'Learn about static routing, RIP, and OSPF protocols.',
    difficulty: 'advanced',
    estimatedTime: '60 minutes',
    lessons: [
      {
        id: 'routing-fundamentals',
        title: 'Routing Fundamentals',
        type: 'theory',
        content: `
# Routing Fundamentals

**Routing** is the process of selecting paths in a network to send traffic from source to destination.

## Routing Table
Every router maintains a routing table with:
- **Destination Network**: Where packets are going
- **Subnet Mask**: Defines network size
- **Next Hop**: Next router in the path
- **Interface**: Outgoing interface
- **Metric**: Cost of the route
- **Protocol**: How the route was learned

## Longest Prefix Match
When multiple routes match, the router chooses the most specific (longest prefix):
\`\`\`
Routes in table:
- 0.0.0.0/0 via 192.168.1.1 (default route)
- 10.0.0.0/8 via 192.168.2.1
- 10.1.0.0/16 via 192.168.3.1
- 10.1.1.0/24 via 192.168.4.1

Destination: 10.1.1.100
Best match: 10.1.1.0/24 (most specific)
\`\`\`

## Route Types
### Static Routes
- **Manually configured** by administrator
- **Pros**: Predictable, secure, low overhead
- **Cons**: No automatic failover, manual updates needed

### Dynamic Routes
- **Learned automatically** from routing protocols
- **Pros**: Automatic updates, failover capability
- **Cons**: More complex, uses bandwidth for updates

## Administrative Distance
Trustworthiness of route sources (lower = more trusted):
- Connected: 0
- Static: 1
- EIGRP: 90
- OSPF: 110
- RIP: 120
        `,
      },
      {
        id: 'rip-protocol',
        title: 'RIP (Routing Information Protocol)',
        type: 'theory',
        content: `
# RIP (Routing Information Protocol)

**RIP** is a simple distance-vector routing protocol that uses hop count as its metric.

## Key Characteristics
- **Metric**: Hop count (maximum 15, 16 = infinity)
- **Updates**: Every 30 seconds
- **Type**: Distance vector
- **Convergence**: Slow but simple

## How RIP Works
1. **Initialization**: Router knows only connected networks
2. **Advertising**: Sends entire routing table to neighbors
3. **Learning**: Receives updates from neighbors
4. **Best Path**: Chooses route with lowest hop count
5. **Updates**: Periodic updates every 30 seconds

## RIP Version Comparison
### RIPv1
- **Classful** routing (no subnet masks in updates)
- **Broadcast** updates (255.255.255.255)
- **No authentication**

### RIPv2
- **Classless** routing (includes subnet masks)
- **Multicast** updates (224.0.0.9)
- **Authentication** support
- **Route tags** for external routes

## Configuration Example
\`\`\`
Router(config)# router rip
Router(config-router)# version 2
Router(config-router)# network 192.168.1.0
Router(config-router)# network 10.0.0.0
Router(config-router)# no auto-summary
\`\`\`

## RIP Limitations
- **Slow convergence** (can take minutes)
- **Count to infinity** problem
- **Limited scalability** (15 hop limit)
- **Bandwidth usage** (periodic full updates)
        `,
      },
      {
        id: 'ospf-protocol',
        title: 'OSPF (Open Shortest Path First)',
        type: 'theory',
        content: `
# OSPF (Open Shortest Path First)

**OSPF** is an advanced link-state routing protocol that uses bandwidth as its metric.

## Key Characteristics
- **Type**: Link-state protocol
- **Metric**: Cost based on bandwidth
- **Algorithm**: Dijkstra's Shortest Path First
- **Convergence**: Fast (subsecond)
- **Scalability**: Excellent (hierarchical design)

## OSPF Operation
1. **Hello Protocol**: Discovers and maintains neighbors
2. **Database Exchange**: Synchronizes link-state database (LSDB)
3. **SPF Calculation**: Runs Dijkstra algorithm
4. **Route Installation**: Installs best paths in routing table

## OSPF Areas
OSPF uses **areas** for hierarchical routing:

### Area Types
- **Area 0 (Backbone)**: Must exist, connects all other areas
- **Standard Areas**: Normal OSPF areas
- **Stub Areas**: Don't receive external routes
- **Totally Stubby**: Only receive default route

### Router Types
- **Internal Router**: All interfaces in same area
- **Area Border Router (ABR)**: Connects multiple areas
- **Autonomous System Border Router (ASBR)**: Connects to external networks

## LSA (Link State Advertisement) Types
- **Type 1**: Router LSAs (internal routes)
- **Type 2**: Network LSAs (transit networks)
- **Type 3**: Summary LSAs (inter-area routes)
- **Type 5**: External LSAs (external routes)

## Configuration Example
\`\`\`
Router(config)# router ospf 1
Router(config-router)# router-id 1.1.1.1
Router(config-router)# network 192.168.1.0 0.0.0.255 area 0
Router(config-router)# network 10.1.1.0 0.0.0.255 area 1
\`\`\`

## OSPF Advantages
- **Fast convergence**
- **Supports VLSM** (Variable Length Subnet Masking)
- **Load balancing** over equal-cost paths
- **Hierarchical design** reduces routing table size
- **Authentication** support
        `,
      }
    ]
  }
];

interface EducationalTutorialsProps {
  onClose: () => void;
}

export default function EducationalTutorials({ onClose }: EducationalTutorialsProps) {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const markLessonComplete = (lessonId: string) => {
    setCompletedLessons(prev => new Set([...prev, lessonId]));
  };

  const handleQuizSubmit = () => {
    setShowQuizResults(true);
    markLessonComplete(selectedTutorial!.lessons[currentLessonIndex].id);
  };

  const calculateQuizScore = (): { score: number; total: number } => {
    if (!selectedTutorial) return { score: 0, total: 0 };
    
    const currentLesson = selectedTutorial.lessons[currentLessonIndex];
    if (!currentLesson.quiz) return { score: 0, total: 0 };

    const correct = currentLesson.quiz.reduce((count, question, index) => {
      return count + (quizAnswers[index] === question.correctAnswer ? 1 : 0);
    }, 0);

    return { score: correct, total: currentLesson.quiz.length };
  };

  const renderTutorialList = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Educational Tutorials</h2>
      <div className="grid gap-4">
        {tutorials.map(tutorial => (
          <div key={tutorial.id} className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
               onClick={() => setSelectedTutorial(tutorial)}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-blue-600">{tutorial.title}</h3>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                tutorial.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                tutorial.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {tutorial.difficulty.charAt(0).toUpperCase() + tutorial.difficulty.slice(1)}
              </span>
            </div>
            <p className="text-gray-600 mb-2">{tutorial.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">⏱️ {tutorial.estimatedTime}</span>
              <span className="text-sm text-gray-500">📚 {tutorial.lessons.length} lessons</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLesson = () => {
    if (!selectedTutorial) return null;
    
    const lesson = selectedTutorial.lessons[currentLessonIndex];
    const isCompleted = completedLessons.has(lesson.id);

    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">{selectedTutorial.title}</h2>
            <h3 className="text-lg text-gray-600">{lesson.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted && <FaCheckCircle className="text-green-500" />}
            <span className="text-sm text-gray-500">
              {currentLessonIndex + 1} of {selectedTutorial.lessons.length}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentLessonIndex + 1) / selectedTutorial.lessons.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="bg-white border rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
          {lesson.type === 'theory' && (
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: lesson.content.replace(/\n/g, '<br>') }} />
            </div>
          )}

          {lesson.type === 'quiz' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">{lesson.content}</h4>
              {lesson.quiz?.map((question, qIndex) => (
                <div key={qIndex} className="mb-6 p-4 border rounded">
                  <p className="font-medium mb-3">{qIndex + 1}. {question.question}</p>
                  <div className="space-y-2">
                    {question.options.map((option, oIndex) => (
                      <label key={oIndex} className="flex items-center">
                        <input
                          type="radio"
                          name={`question-${qIndex}`}
                          value={oIndex}
                          onChange={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                          className="mr-2"
                          disabled={showQuizResults}
                        />
                        <span className={showQuizResults ? (
                          oIndex === question.correctAnswer ? 'text-green-600 font-medium' :
                          quizAnswers[qIndex] === oIndex ? 'text-red-600' : ''
                        ) : ''}>
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                  {showQuizResults && (
                    <div className="mt-3 p-3 bg-blue-50 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              
              {!showQuizResults && (
                <button
                  onClick={handleQuizSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={Object.keys(quizAnswers).length < (lesson.quiz?.length || 0)}
                >
                  Submit Quiz
                </button>
              )}

              {showQuizResults && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <h5 className="font-semibold mb-2">Quiz Results</h5>
                  {(() => {
                    const { score, total } = calculateQuizScore();
                    const percentage = (score / total) * 100;
                    return (
                      <div>
                        <p>Score: {score}/{total} ({percentage.toFixed(0)}%)</p>
                        <div className="mt-2">
                          {percentage >= 80 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <FaCheckCircle /> Great job! You can proceed to the next lesson.
                            </span>
                          ) : (
                            <span className="text-yellow-600 flex items-center gap-1">
                              <FaExclamationTriangle /> Consider reviewing the material before proceeding.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {lesson.type === 'hands-on' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">{lesson.content}</h4>
              <div className="space-y-4">
                {lesson.tasks?.map((task, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <p className="font-medium">{index + 1}. {task.description}</p>
                    <p className="text-sm text-gray-600 mt-1">💡 {task.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ℹ️ Complete these tasks in the network simulator, then return to mark this lesson as complete.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTutorial(null)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Back to Tutorials
            </button>
            {currentLessonIndex > 0 && (
              <button
                onClick={() => {
                  setCurrentLessonIndex(currentLessonIndex - 1);
                  setShowQuizResults(false);
                  setQuizAnswers({});
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center gap-2"
              >
                <FaChevronLeft /> Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lesson.type === 'hands-on' && !isCompleted && (
              <button
                onClick={() => markLessonComplete(lesson.id)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Mark Complete
              </button>
            )}
            {currentLessonIndex < selectedTutorial.lessons.length - 1 && (
              <button
                onClick={() => {
                  setCurrentLessonIndex(currentLessonIndex + 1);
                  setShowQuizResults(false);
                  setQuizAnswers({});
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                disabled={lesson.type === 'quiz' && !showQuizResults}
              >
                Next <FaChevronRight />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-5/6 h-5/6 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-300">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FaBook className="text-blue-600" />
            Network Learning Center
          </h1>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!selectedTutorial ? renderTutorialList() : renderLesson()}
        </div>
      </div>
    </div>
  );
}