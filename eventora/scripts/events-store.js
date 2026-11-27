/* ==========================================================================
   EVENTORA SAMPLE CATALOG & SEARCH ENGINE
   Illustrative multi-event data structures for UI exploration & dynamic routing
   ========================================================================== */

window.EventoraStore = (function () {
  const PREVIEW_STORAGE_KEY = 'eventora_preview_events_v1';
  const OVERRIDES_STORAGE_KEY = 'eventora_org_overrides_v1';
  const DELETED_STORAGE_KEY = 'eventora_deleted_slugs_v1';
  const ACTIVITY_STORAGE_KEY = 'eventora_org_activity_v1';
  const COLLABS_STORAGE_KEY = 'eventora_org_collabs_v1';

  const STATUS_META = {
    draft: { key: 'draft', label: 'Draft', badgeClass: 'ev-badge-sample' },
    published: { key: 'published', label: 'Published', badgeClass: 'ev-badge-open' },
    ongoing: { key: 'ongoing', label: 'Ongoing', badgeClass: 'ev-badge-filling' },
    completed: { key: 'completed', label: 'Completed', badgeClass: 'ev-badge-closed' },
    cancelled: { key: 'cancelled', label: 'Cancelled', badgeClass: 'ev-badge-closed' }
  };

  const ROUND_TYPES = [
    { key: 'quiz', label: 'Quiz Round', badge: 'Quiz', categoryHint: 'Timed Quiz', description: 'Knowledge quiz with question count, marks per question, and timer.' },
    { key: 'coding', label: 'Coding Round', badge: 'Coding', categoryHint: 'Programming', description: 'Problem-solving stage with language options, problem count, and score cap.' },
    { key: 'mcq', label: 'MCQ Round', badge: 'MCQ', categoryHint: 'Objective Test', description: 'Multiple-choice screening test with negative marking options.' },
    { key: 'frontend', label: 'Frontend Development Round', badge: 'Frontend', categoryHint: 'UI & Web Build', description: 'Interface engineering task with design brief, stack, and submission rules.' },
    { key: 'presentation', label: 'Presentation Round', badge: 'Presentation', categoryHint: 'Pitch & Demo', description: 'Team or individual stage demo with jury rubric and deck submission.' },
    { key: 'workshop', label: 'Workshop Round', badge: 'Workshop', categoryHint: 'Guided Session', description: 'Interactive hands-on session with venue/link and attendance notes.' },
    { key: 'treasure_hunt', label: 'Treasure Hunt / Hunting Round', badge: 'Treasure Hunt', categoryHint: 'Clue Hunt', description: 'Campus or virtual clue-solving stage with clue count and scoring rules.' },
    { key: 'puzzle', label: 'Puzzle / Logical Round', badge: 'Puzzle', categoryHint: 'Logic & Puzzles', description: 'Logical reasoning, puzzles, or cryptographic stage challenges.' },
    { key: 'manual', label: 'Manual Evaluation Round', badge: 'Manual Eval', categoryHint: 'Judge Review', description: 'Submission grading performed manually by judges or domain mentors.' },
    { key: 'custom', label: 'Custom Round', badge: 'Custom', categoryHint: 'Flexible Format', description: 'Organizer-defined stage with custom format title and evaluation setup.' }
  ];

  const QUALIFICATION_MODES = [
    { key: 'all', label: 'Open to all registered participants' },
    { key: 'previous_round', label: 'Requires qualification from a previous round' },
    { key: 'min_score', label: 'Uses a minimum score' },
    { key: 'shortlist', label: 'Uses a manually selected shortlist' }
  ];

  const REGISTRATION_STATUSES = ['Pending', 'Approved', 'Waitlisted', 'Rejected', 'Cancelled'];
  const TEAM_STATUSES = ['Active', 'Full', 'Awaiting Members', 'Locked'];

  const LIVE_EVENT_STATUSES = ['Upcoming', 'Live', 'Paused', 'Completed'];
  const LIVE_ROUND_STATUSES = ['Upcoming', 'Live', 'Paused', 'Completed', 'Cancelled'];
  const LIVE_TIMER_STATES = ['Idle', 'Running', 'Paused', 'Ended', 'Expired'];
  const LIVE_PARTICIPATION_STATUSES = ['Not Started', 'Active', 'Submitted', 'Completed', 'Absent', 'Disqualified'];
  const ANNOUNCEMENT_TEMPLATES = [
    { key: 'Event Started', title: 'Event is Now Live', message: 'Welcome everyone! Our event operations are officially underway. Please review the active round instructions and check in with coordinators.' },
    { key: 'Round Starting', title: 'Round Starting Soon', message: 'The upcoming round is opening shortly. Ensure your workspace, credentials, or team setup are ready before the countdown begins.' },
    { key: 'Round Paused', title: 'Round Temporarily Paused', message: 'The active round timer has been paused for an operational announcement or technical check. Please stand by for the resume notice.' },
    { key: 'Round Resumed', title: 'Round Timer Resumed', message: 'Operations have resumed and the active countdown clock is running again. Continue with your submissions before expiry.' },
    { key: 'Round Completed', title: 'Round Concluded', message: 'Thank you for participating in this stage. The round is now closed while organizers review submissions and prepare next steps.' },
    { key: 'Next Round', title: 'Advancing to Next Round', message: 'We are moving forward to the next scheduled stage. Check the round schedule and eligibility instructions carefully.' },
    { key: 'Submission Reminder', title: 'Submission Window Closing Soon', message: 'Friendly reminder: remaining time on the current round timer is running low. Please finalize and submit your deliverables before time expires.' },
    { key: 'Venue Instructions', title: 'Venue & Check-In Instructions', message: 'On-site coordinators are stationed at the main desk. Keep your registration ID ready for stage verification.' },
    { key: 'Custom Announcement', title: '', message: '' }
  ];

  const CONTENT_STATUSES = ['No Content', 'Draft', 'Ready', 'Published', 'Archived'];
  const PDF_CATEGORIES = ['Question Paper', 'Instructions', 'Reference Document', 'Additional Material'];
  const CONTENT_AVAILABILITY_MODES = [
    { key: 'locked', label: 'Locked Before Release (Organizer Only)' },
    { key: 'on_round_start', label: 'Release When Round Starts (Live Control)' },
    { key: 'live_only', label: 'Available Only While Round is Live' },
    { key: 'scheduled', label: 'Unlock at Scheduled Date & Time' },
    { key: 'registered_immediately', label: 'Released Manually to Eligible Participants' }
  ];
  const CODING_LANGUAGES = ['C', 'C++', 'Java', 'Python'];
  const ATTACHMENT_CATEGORIES = ['Challenge PDF', 'Design Image', 'Starter File', 'ZIP Archive', 'Problem PDF', 'Additional Material'];
  const QUESTION_TYPES = [
    { key: 'mcq', label: 'MCQ Single Choice' },
    { key: 'mcq_multi', label: 'Multiple Correct Answers' },
    { key: 'true_false', label: 'True / False' },
    { key: 'short_answer', label: 'Short Answer / Puzzle' }
  ];
  const EVALUATION_STATUSES = ['Not Evaluated', 'Under Review', 'Evaluated', 'Approved', 'Rejected'];
  const QUALIFICATION_STRATEGIES = [
    { key: 'top_n', label: 'Top N Ranked' },
    { key: 'min_score', label: 'Minimum Score' },
    { key: 'percentage', label: 'Percentage Threshold' },
    { key: 'manual', label: 'Manual Selection' },
    { key: 'combined', label: 'Minimum Score + Top N Cap' }
  ];
  const TIE_BREAKER_MODES = [
    { key: 'earlier_submission', label: 'Earlier Submission Timestamp' },
    { key: 'criterion_score', label: 'Higher Score in Selected Criterion' },
    { key: 'other_round_score', label: 'Higher Score in Selected Round' },
    { key: 'manual', label: 'Manual Tie Resolution Order' }
  ];
  const OVERALL_SCORING_MODES = [
    { key: 'weighted_percentage', label: 'Weighted Normalized Round Percentages (%)' },
    { key: 'sum_raw', label: 'Sum of Selected Round Scores' },
    { key: 'manual_final', label: 'Manual Final Overall Score' }
  ];
  const MULTI_ANSWER_SCORING_RULES = [
    { key: 'exact_match', label: 'Exact Match Only (All correct, zero wrong)' },
    { key: 'partial_credit', label: 'Partial Credit (Capped <= Max Marks)' }
  ];
  const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
  const MATERIAL_CATEGORIES = [
    'Prompt / Brief',
    'Dataset / Starter Kit',
    'Slide / Rubric',
    'Clue Template',
    'Link Reference'
  ];
  const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB cap with IndexedDB storage
  const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

  const CUSTOM_FIELD_TYPES = [
    { key: 'text', label: 'Short Text' },
    { key: 'textarea', label: 'Long Text' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'number', label: 'Number' },
    { key: 'dropdown', label: 'Dropdown' },
    { key: 'multiple_choice', label: 'Multiple Choice' },
    { key: 'checkbox', label: 'Checkbox' },
    { key: 'url', label: 'URL' }
  ];

  const DEFAULT_FORM_FIELDS = [
    { id: 'fld_fullName', key: 'fullName', label: 'Full Name', fieldType: 'text', helpText: 'Used on your participant pass and roster.', required: true, enabled: true, isDefault: true, order: 1, options: [] },
    { id: 'fld_email', key: 'email', label: 'Email', fieldType: 'email', helpText: 'Matched to your Eventora account.', required: true, enabled: true, isDefault: true, order: 2, options: [] },
    { id: 'fld_phone', key: 'phone', label: 'Phone Number', fieldType: 'phone', helpText: 'Optional contact number for on-site coordination.', required: false, enabled: true, isDefault: true, order: 3, options: [] },
    { id: 'fld_institution', key: 'institution', label: 'Institution / College', fieldType: 'text', helpText: 'University, campus, or organization name.', required: true, enabled: true, isDefault: true, order: 4, options: [] },
    { id: 'fld_department', key: 'department', label: 'Department', fieldType: 'text', helpText: 'Academic branch, lab, or discipline.', required: false, enabled: true, isDefault: true, order: 5, options: [] },
    { id: 'fld_yearOfStudy', key: 'yearOfStudy', label: 'Year of Study', fieldType: 'dropdown', helpText: 'Current academic standing.', required: false, enabled: true, isDefault: true, order: 6, options: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate', 'Faculty / Mentor', 'Other'] },
    { id: 'fld_city', key: 'city', label: 'City', fieldType: 'text', helpText: 'Current city or campus location.', required: false, enabled: true, isDefault: true, order: 7, options: [] },
    { id: 'fld_participantType', key: 'participantType', label: 'Participant Type', fieldType: 'dropdown', helpText: 'Primary role at this event.', required: false, enabled: true, isDefault: true, order: 8, options: ['Student', 'Researcher', 'Developer / Builder', 'Designer', 'Speaker / Guest', 'Other'] }
  ];

  const CATEGORIES = [
    {
      slug: 'hackathons',
      name: 'Hackathons',
      description: '24 to 48-hour collaborative product builds with live mentorship and prototype demos.',
      accent: '#183B2A',
      icon: 'code'
    },
    {
      slug: 'coding',
      name: 'Coding Competitions',
      description: 'Timed algorithmic problem solving, debugging sprints, and ranked team leaderboards.',
      accent: '#2F5943',
      icon: 'terminal'
    },
    {
      slug: 'workshops',
      name: 'Workshops',
      description: 'Hands-on hardware, robotics, cloud architecture, and design systems labs.',
      accent: '#56785C',
      icon: 'wrench'
    },
    {
      slug: 'technical',
      name: 'Technical Events',
      description: 'Campus engineering challenges, capture-the-flag arenas, and paper symposia.',
      accent: '#234C38',
      icon: 'cpu'
    },
    {
      slug: 'cultural',
      name: 'Cultural Festivals',
      description: 'Evening stage showcases, interactive media arts, and multi-campus college fests.',
      accent: '#4C6B53',
      icon: 'sparkles'
    },
    {
      slug: 'entrepreneurship',
      name: 'Entrepreneurship',
      description: 'Venture ideation, founder fireside panels, and live investor pitch rounds.',
      accent: '#395A45',
      icon: 'rocket'
    },
    {
      slug: 'seminars',
      name: 'Seminars',
      description: 'Guest faculty keynotes, applied research talks, and industry career colloquia.',
      accent: '#56785C',
      icon: 'mic'
    },
    {
      slug: 'innovation',
      name: 'Innovation Challenges',
      description: 'Sustainability, civic tech, and cross-disciplinary campus impact tracks.',
      accent: '#183B2A',
      icon: 'compass'
    }
  ];

  // Illustrative Showcase Events (distinct schemas, varied round counts: 3, 2, 4, 1, 0, 2)
  const SAMPLE_EVENTS = [
    {
      slug: 'solstice-campus-hack',
      isSample: true,
      featured: true,
      name: 'Solstice Open Campus Hackathon',
      tagline: 'Thirty-six hours of collaborative climate, civic, and developer tooling engineering under open campus trees.',
      category: 'hackathons',
      categoryLabel: 'Hackathons',
      organizer: 'ACM Student Innovation Collective',
      institution: 'Pacific Ridge Institute of Technology',
      institutionShort: 'Pacific Ridge Tech',
      city: 'Bengaluru',
      location: 'Glass Atrium & West Lawn, Bengaluru',
      mode: 'In-Person',
      dateLabel: 'Dec 12 – Dec 14, 2026',
      dateWindow: 'this-month',
      startTimeISO: '2026-12-12T09:00:00',
      coverImage: 'assets/event-hackathon.jpg',
      accentColor: '#183B2A',
      eventStatus: 'Published',
      registrationStatus: 'Open',
      registrationBadgeClass: 'ev-badge-open',
      participationType: 'team',
      teamConfig: {
        supported: true,
        minSize: 2,
        maxSize: 4,
        label: 'Teams of 2–4 members'
      },
      description: 'Solstice Open Campus Hackathon brings together designers, builders, and systems thinkers for three days of outdoor keynotes and focused atrium hacking. Organizers configure multi-round shortlisting, mentor checkpoints, and live stage judging directly through Eventora.',
      schedule: [
        { time: 'Day 1 • 09:00 AM', title: 'Check-In, Team Formation & Opening Lawn Briefing', detail: 'Badge verification and problem track reveal at the West Lawn stage.' },
        { time: 'Day 1 • 11:30 AM', title: 'Architecture Proposals & Round 1 Submission', detail: 'Teams publish a concise system blueprint and feasibility brief.' },
        { time: 'Day 2 • 02:00 PM', title: 'Mid-Sprint Mentor Audits & Prototype Check', detail: 'Assigned domain mentors review live repositories and UX prototypes.' },
        { time: 'Day 3 • 10:00 AM', title: 'Main Stage Live Demos & Jury Evaluation', detail: 'Top shortlisted squads present working builds to the faculty and alumni panel.' }
      ],
      rounds: [
        {
          order: 1,
          name: 'Architecture & Problem Framing',
          type: 'Proposal Screening',
          status: 'Scheduled',
          duration: '4 Hours',
          eligibility: 'All Registered Squads',
          startTime: 'Dec 12, 11:30 AM',
          instructions: 'Submit problem statement selection, architecture diagram, and initial repo commit via your squad dashboard.'
        },
        {
          order: 2,
          name: 'Working Prototype Evaluation',
          type: 'Technical Audit',
          status: 'Scheduled',
          duration: '24 Hours',
          eligibility: 'Approved Squads from Round 1',
          startTime: 'Dec 13, 02:00 PM',
          instructions: 'Deploy a live testable build and complete a 5-minute mentor walkthrough at your assigned atrium bay.'
        },
        {
          order: 3,
          name: 'Open Lawn Demo Finale',
          type: 'Jury Rubric Scoring',
          status: 'Scheduled',
          duration: '3 Hours',
          eligibility: 'Top 12 Shortlisted Teams',
          startTime: 'Dec 14, 10:00 AM',
          instructions: 'Deliver a 4-minute live demo followed by 2 minutes of technical Q&A scored across feasibility, craft, and impact.'
        }
      ],
      rules: [
        'All code and hardware integrations must be created during the active event window; open-source libraries are permitted with attribution.',
        'Cross-department and cross-year squads of 2 to 4 students are encouraged.',
        'Each squad must attend both scheduled mentor checkpoint windows to remain eligible for Stage 3 demos.',
        'Organizer announcements and round cutoffs are communicated in real time inside the Eventora participant view.'
      ],
      organizers: [
        { name: 'Ananya Deshmukh', role: 'Lead Event Organizer', department: 'Computer Science Club' },
        { name: 'Dr. Rohan Kulkarni', role: 'Faculty Coordinator', department: 'School of Computing' },
        { name: 'Meera Nair', role: 'Logistics & Venue Manager', department: 'Student Council' }
      ],
      faqs: [
        { q: 'Can first-year undergraduates join?', a: 'Yes! Dedicated beginner-friendly mentorship booths run throughout Day 1 and Day 2.' },
        { q: 'Do we need a pre-formed team before registering?', a: 'You can create a new squad code on Eventora or join an existing open squad before registrations lock.' }
      ]
    },
    {
      slug: 'verdant-hardware-design-lab',
      isSample: true,
      featured: true,
      name: 'Verdant Robotics & Interaction Lab',
      tagline: 'Hands-on embedded sensing, rapid CAD enclosure prototyping, and physical computing design workshop.',
      category: 'workshops',
      categoryLabel: 'Workshops',
      organizer: 'Mechatronics & Design Guild',
      institution: 'Sahyadri College of Engineering',
      institutionShort: 'Sahyadri Engineering',
      city: 'Pune',
      location: 'Makerspace North Hall, Pune',
      mode: 'In-Person',
      dateLabel: 'Dec 18 – Dec 19, 2026',
      dateWindow: 'this-month',
      startTimeISO: '2026-12-18T10:00:00',
      coverImage: 'assets/event-workshop.jpg',
      accentColor: '#56785C',
      eventStatus: 'Published',
      registrationStatus: 'Filling Fast',
      registrationBadgeClass: 'ev-badge-filling',
      participationType: 'team',
      teamConfig: {
        supported: true,
        minSize: 1,
        maxSize: 2,
        label: 'Solo or Duo (1–2 members)'
      },
      description: 'A tactile two-day campus studio where students pair microcontroller sensor arrays with clean responsive web interfaces. All hardware kits are provisioned on site; participants progress through two structured build milestones.',
      schedule: [
        { time: 'Day 1 • 10:00 AM', title: 'Sensor Kits & Wiring Fundamentals', detail: 'Hands-on orientation with microcontrollers and telemetry buses.' },
        { time: 'Day 1 • 03:00 PM', title: 'Milestone 1: Live Telemetry Calibration', detail: 'Calibrate environmental sensors and stream JSON readings locally.' },
        { time: 'Day 2 • 11:00 AM', title: 'Enclosure Assembly & Studio Showcase', detail: 'Assemble laser-cut enclosures and present working benchtops.' }
      ],
      rounds: [
        {
          order: 1,
          name: 'Sensor Calibration Checkpoint',
          type: 'Lab Verification',
          status: 'Scheduled',
          duration: '90 Mins',
          eligibility: 'All Bench Participants',
          startTime: 'Dec 18, 03:00 PM',
          instructions: 'Demonstrate stable serial telemetry output within ±2% accuracy across three ambient test states.'
        },
        {
          order: 2,
          name: 'Interactive Benchtop Exhibition',
          type: 'Peer & Mentor Review',
          status: 'Scheduled',
          duration: '2 Hours',
          eligibility: 'Milestone 1 Cleared',
          startTime: 'Dec 19, 02:00 PM',
          instructions: 'Showcase an interactive hardware-to-browser experience to visiting engineering mentors.'
        }
      ],
      rules: [
        'Bench hardware kits must be checked back in at the North Hall desk at close of Day 2.',
        'Solo participants and pairs of 2 share equal workstation bench resources.',
        'Safety goggles and soldering protocols are mandatory inside Fabrication Zone B.'
      ],
      organizers: [
        { name: 'Siddharth Menon', role: 'Workshop Director', department: 'Mechatronics Guild' },
        { name: 'Kavya Sharma', role: 'Hardware Mentor Lead', department: 'Electronics & Robotics' }
      ],
      faqs: [
        { q: 'Are components provided?', a: 'Yes, microcontroller boards, breadboards, and environmental sensors are included per bench.' },
        { q: 'Do I need to bring a laptop?', a: 'Please bring one laptop per solo participant or duo for firmware flashing and UI testing.' }
      ]
    },
    {
      slug: 'horizon-campus-founders-summit',
      isSample: true,
      featured: true,
      name: 'Horizon Campus Founders & Culture Summit',
      tagline: 'Four-stage student venture pitch competition culminating in a twilight outdoor amphitheater showcase.',
      category: 'entrepreneurship',
      categoryLabel: 'Entrepreneurship',
      organizer: 'E-Cell & Campus Arts Alliance',
      institution: 'National University of Design & Tech',
      institutionShort: 'NUDT Campus',
      city: 'Hyderabad',
      location: 'Open-Air Amphitheater, Hyderabad',
      mode: 'Hybrid',
      dateLabel: 'Jan 09 – Jan 11, 2027',
      dateWindow: 'upcoming',
      startTimeISO: '2027-01-09T14:00:00',
      coverImage: 'assets/event-summit.jpg',
      accentColor: '#395A45',
      eventStatus: 'Published',
      registrationStatus: 'Open',
      registrationBadgeClass: 'ev-badge-open',
      participationType: 'team',
      teamConfig: {
        supported: true,
        minSize: 2,
        maxSize: 5,
        label: 'Teams of 2–5 founders'
      },
      description: 'Uniting student founders, creative technologists, and alumni angels for three days of outdoor fireside conversations and a progressive 4-round pitch tournament under evening campus lights.',
      schedule: [
        { time: 'Jan 09 • 02:00 PM', title: 'Concept Deck Screening (Round 1)', detail: 'Submit 6-slide venture thesis and user discovery insights.' },
        { time: 'Jan 10 • 10:00 AM', title: 'Market Validation & Unit Economics Clinic', detail: 'Live Q&A rooms with regional founders and product leaders.' },
        { time: 'Jan 11 • 05:30 PM', title: 'Twilight Amphitheater Grand Pitch', detail: 'Finalists pitch live under campus fest lights before an open audience.' }
      ],
      rounds: [
        {
          order: 1,
          name: 'Venture Thesis Submission',
          type: 'Deck Screening',
          status: 'Scheduled',
          duration: '48 Hours',
          eligibility: 'All Registered Teams',
          startTime: 'Jan 09, 02:00 PM',
          instructions: 'Upload PDF problem-solution summary and validation notes.'
        },
        {
          order: 2,
          name: 'Customer Discovery Sprint',
          type: 'Mentor Review',
          status: 'Scheduled',
          duration: '4 Hours',
          eligibility: 'Top 40 Teams',
          startTime: 'Jan 10, 10:00 AM',
          instructions: 'Present 10 real campus or customer interview findings to assigned judges.'
        },
        {
          order: 3,
          name: 'Semi-Final Boardroom Pitch',
          type: 'Jury Evaluation',
          status: 'Scheduled',
          duration: '3 Hours',
          eligibility: 'Top 16 Teams',
          startTime: 'Jan 10, 04:00 PM',
          instructions: '5-minute deck defense focusing on product differentiation and feasibility.'
        },
        {
          order: 4,
          name: 'Twilight Amphitheater Finale',
          type: 'Main Stage Pitch',
          status: 'Scheduled',
          duration: '2 Hours',
          eligibility: 'Top 6 Finalists',
          startTime: 'Jan 11, 06:00 PM',
          instructions: 'Deliver a crisp 6-minute stage narrative plus live investor Q&A.'
        }
      ],
      rules: [
        'Student teams must hold at least 75% enrolled undergraduate or postgraduate membership.',
        'Pre-seed prototypes built prior to the summit are allowed if disclosed in Round 1.',
        'Each advancing team receives dedicated rehearsal access at the Amphitheater stage.'
      ],
      organizers: [
        { name: 'Vikramaditya Rao', role: 'Summit Chair', department: 'E-Cell Leadership' },
        { name: 'Nandini Iyer', role: 'Founder Relations', department: 'Alumni Incubator' }
      ],
      faqs: [
        { q: 'Can remote college teams apply for Round 1?', a: 'Yes, Round 1 and Round 2 support hybrid video rooms; Round 4 finalists present on campus.' }
      ]
    },
    {
      slug: 'algorithmia-autumn-open',
      isSample: true,
      featured: false,
      name: 'Algorithmia Competitive Programming Open',
      tagline: 'Single-stage 3-hour algorithmic challenge testing graph intuition, dynamic programming, and clean code speed.',
      category: 'coding',
      categoryLabel: 'Coding Competitions',
      organizer: 'Competitive Programming Society',
      institution: 'Deccan Institute of Information Sciences',
      institutionShort: 'Deccan InfoSci',
      city: 'Online',
      location: 'Online Proctored Arena',
      mode: 'Online',
      dateLabel: 'Dec 06, 2026',
      dateWindow: 'this-week',
      startTimeISO: '2026-12-06T18:00:00',
      coverImage: 'assets/event-coding.jpg',
      accentColor: '#2F5943',
      eventStatus: 'Published',
      registrationStatus: 'Open',
      registrationBadgeClass: 'ev-badge-open',
      participationType: 'individual',
      teamConfig: {
        supported: false,
        minSize: 1,
        maxSize: 1,
        label: 'Individual Participation'
      },
      description: 'A focused single-round competitive coding contest designed for individual problem solvers across universities. Rankings combine solved problem count with cumulative time penalty.',
      schedule: [
        { time: '05:40 PM', title: 'Sandbox Warmup & Compiler Check', detail: 'Verify C++, Python, Java, and Rust test environment setup.' },
        { time: '06:00 PM', title: 'Contest Window Opens (6 Problems)', detail: 'Three continuous hours of algorithmic problem solving.' },
        { time: '09:15 PM', title: 'Editorial Walkthrough & Standings Freeze Lift', detail: 'Problem authors publish optimal proofs and final standings.' }
      ],
      rounds: [
        {
          order: 1,
          name: 'Rated 3-Hour Contest Arena',
          type: 'Automated Test Grading',
          status: 'Scheduled',
          duration: '180 Mins',
          eligibility: 'Verified Individual Registrants',
          startTime: 'Dec 06, 06:00 PM',
          instructions: 'Solve 6 graded problems in ascending difficulty. Wrong submissions add a 10-minute penalty upon acceptance.'
        }
      ],
      rules: [
        'Strictly individual participation; sharing solution code or hints during the live window results in disqualification.',
        'Standard language libraries are permitted; external generative code assistance is disabled during the rated window.'
      ],
      organizers: [
        { name: 'Arjun Subramanian', role: 'Chief Problem Setter', department: 'CP Society' }
      ],
      faqs: [
        { q: 'Which languages are supported?', a: 'C17, C++20, Python 3.12, Java 21, and Rust are enabled.' }
      ]
    },
    {
      slug: 'sustainable-systems-colloquium',
      isSample: true,
      featured: false,
      name: 'Campus Systems & Green Computing Colloquium',
      tagline: 'Half-day academic seminar exploring low-energy inference, distributed architectures, and open university research.',
      category: 'seminars',
      categoryLabel: 'Seminars',
      organizer: 'Graduate Research Forum',
      institution: 'Central Science & Engineering Campus',
      institutionShort: 'Central SciEng',
      city: 'Chennai',
      location: 'Maple Courtyard Lecture Hall, Chennai',
      mode: 'In-Person',
      dateLabel: 'Dec 04, 2026',
      dateWindow: 'this-week',
      startTimeISO: '2026-12-04T10:30:00',
      coverImage: 'assets/event-campus-fest.jpg',
      accentColor: '#56785C',
      eventStatus: 'Published',
      registrationStatus: 'Open',
      registrationBadgeClass: 'ev-badge-open',
      participationType: 'individual',
      teamConfig: {
        supported: false,
        minSize: 1,
        maxSize: 1,
        label: 'Individual Attendee Pass'
      },
      description: 'An open-registration seminar series featuring three keynote talks and a moderated Q&A panel on energy-aware software engineering. Notice this single-session seminar intentionally uses an overview + schedule layout without competitive rounds.',
      schedule: [
        { time: '10:30 AM', title: 'Opening Remarks & Coffee Reception', detail: 'Check-in at Maple Courtyard.' },
        { time: '11:00 AM', title: 'Keynote: Carbon-Aware Compute Scheduling', detail: 'Presented by Prof. Aditi Krishnan.' },
        { time: '01:00 PM', title: 'Student Poster Walk & Networking Lawn', detail: 'Informal lab poster demonstrations outdoors.' }
      ],
      rounds: [],
      rules: [
        'Carry your student or institution ID card for hall seating verification.',
        'Doors open 20 minutes prior to the opening keynote.'
      ],
      organizers: [
        { name: 'Prof. Aditi Krishnan', role: 'Faculty Chair', department: 'Systems Research Lab' },
        { name: 'Devika Joshi', role: 'Program Curator', department: 'Graduate Forum' }
      ],
      faqs: [
        { q: 'Is there a competitive elimination round?', a: 'No, this is a non-competitive seminar event focused on talks, Q&A, and poster networking.' }
      ]
    },
    {
      slug: 'canopy-civic-innovation-challenge',
      isSample: true,
      featured: false,
      name: 'Canopy Civic & Urban Mobility Challenge',
      tagline: 'Cross-campus design and technical challenge tackling clean transit, campus water sensing, and accessible wayfinding.',
      category: 'innovation',
      categoryLabel: 'Innovation Challenges',
      organizer: 'Civic Design Lab',
      institution: 'Westbrook School of Architecture & Tech',
      institutionShort: 'Westbrook Tech',
      city: 'Mumbai',
      location: 'Botanical Courtyard Pavilion, Mumbai',
      mode: 'In-Person',
      dateLabel: 'Dec 21 – Dec 22, 2026',
      dateWindow: 'this-month',
      startTimeISO: '2026-12-21T09:30:00',
      coverImage: 'assets/event-pavilion.jpg',
      accentColor: '#183B2A',
      eventStatus: 'Published',
      registrationStatus: 'Closing Soon',
      registrationBadgeClass: 'ev-badge-fast',
      participationType: 'team',
      teamConfig: {
        supported: true,
        minSize: 2,
        maxSize: 4,
        label: 'Teams of 2–4 members'
      },
      description: 'Architecture students, software engineers, and policy researchers team up for 2 days to prototype tangible civic tools grounded in real urban campus datasets.',
      schedule: [
        { time: 'Dec 21 • 09:30 AM', title: 'Field Walk & Dataset Briefing', detail: 'Tour campus transit nodes with urban mobility researchers.' },
        { time: 'Dec 22 • 03:00 PM', title: 'Final Jury Exhibition', detail: 'Interactive pavilion demonstrations and feedback.' }
      ],
      rounds: [
        {
          order: 1,
          name: 'Field Research Synthesis',
          type: 'Concept Critique',
          status: 'Scheduled',
          duration: '3 Hours',
          eligibility: 'Registered Interdisciplinary Teams',
          startTime: 'Dec 21, 01:00 PM',
          instructions: 'Publish user pain-point map and dataset hypothesis.'
        },
        {
          order: 2,
          name: 'Pavilion Prototype Showcase',
          type: 'Design & Tech Jury',
          status: 'Scheduled',
          duration: '4 Hours',
          eligibility: 'All Participating Teams',
          startTime: 'Dec 22, 03:00 PM',
          instructions: 'Present physical model or interactive software walkthrough at the Pavilion.'
        }
      ],
      rules: [
        'Each squad must blend at least two academic disciplines where possible.',
        'Datasets provided by the Civic Lab remain strictly for educational prototyping.'
      ],
      organizers: [
        { name: 'Kabir Malhotra', role: 'Program Lead', department: 'Civic Design Lab' }
      ],
      faqs: [
        { q: 'Are non-engineering design students welcome?', a: 'Yes! Architecture, design, policy, and engineering perspectives are equally encouraged.' }
      ]
    }
  ];

  function safeJsonRead(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function createRoundId() {
    return `rnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function getRoundTypeCatalog() {
    return ROUND_TYPES.map((t) => ({ ...t }));
  }

  function getRoundTypeMeta(typeKey) {
    return ROUND_TYPES.find((t) => t.key === typeKey) || ROUND_TYPES[ROUND_TYPES.length - 1];
  }

  function mapLegacyRoundTypeKey(rawType, typeKeyHint) {
    if (typeKeyHint && ROUND_TYPES.some((t) => t.key === typeKeyHint)) {
      return typeKeyHint;
    }
    const lower = String(rawType || '').trim().toLowerCase();
    if (!lower) return 'custom';
    if (ROUND_TYPES.some((t) => t.key === lower)) return lower;
    if (lower.includes('mcq')) return 'mcq';
    if (lower.includes('quiz')) return 'quiz';
    if (lower.includes('front')) return 'frontend';
    if (lower.includes('coding') || lower.includes('program') || lower.includes('algorithm')) return 'coding';
    if (lower.includes('present') || lower.includes('pitch') || lower.includes('demo') || lower.includes('showcase')) return 'presentation';
    if (lower.includes('workshop') || lower.includes('lab') || lower.includes('hands-on')) return 'workshop';
    if (lower.includes('hunt') || lower.includes('treasure')) return 'treasure_hunt';
    if (lower.includes('puzzle') || lower.includes('logic')) return 'puzzle';
    if (lower.includes('manual') || lower.includes('jury') || lower.includes('audit') || lower.includes('screen') || lower.includes('evaluat')) return 'manual';
    return 'custom';
  }

  function buildTypeConfig(typeKey, rawConfig, seedDuration) {
    const cfg = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const fallbackDur = String(seedDuration || '60 Mins').trim() || '60 Mins';
    if (typeKey === 'quiz' || typeKey === 'mcq') {
      return {
        questionCount: Math.max(1, Number(cfg.questionCount) || (typeKey === 'mcq' ? 25 : 15)),
        marksPerQuestion: Math.max(0.5, Number(cfg.marksPerQuestion) || 4),
        negativeMarking: Boolean(cfg.negativeMarking),
        negativeMarkValue: Number(cfg.negativeMarkValue) > 0 ? Number(cfg.negativeMarkValue) : 1,
        timeLimitMinutes: Math.max(5, Number(cfg.timeLimitMinutes) || 30),
        questionPlaceholder: String(cfg.questionPlaceholder || 'Question set configured in upcoming test bank phase (no full editor here).').trim()
      };
    }
    if (typeKey === 'coding') {
      const langs = Array.isArray(cfg.languages) && cfg.languages.length
        ? cfg.languages.map((l) => String(l).trim()).filter(Boolean)
        : ['Python', 'C++', 'Java', 'JavaScript'];
      return {
        languages: [...langs],
        durationMinutes: Math.max(15, Number(cfg.durationMinutes) || 90),
        problemCount: Math.max(1, Number(cfg.problemCount) || 3),
        maxScore: Math.max(10, Number(cfg.maxScore) || 300),
        evaluationMode: String(cfg.evaluationMode || 'Automated Test Cases (Placeholder)').trim()
      };
    }
    if (typeKey === 'frontend') {
      return {
        duration: String(cfg.duration || fallbackDur).trim(),
        designBrief: String(cfg.designBrief || '').trim(),
        submissionInstructions: String(cfg.submissionInstructions || 'Submit live preview URL + Git repository link before the deadline.').trim(),
        allowedTechnologies: String(cfg.allowedTechnologies || 'HTML, CSS, JavaScript, React, Tailwind CSS').trim(),
        evaluationCriteria: String(cfg.evaluationCriteria || 'Visual craft, responsive fidelity, accessibility, and code organization.').trim()
      };
    }
    if (typeKey === 'presentation') {
      return {
        presentationDuration: String(cfg.presentationDuration || '8 mins presentation + 4 mins Q&A').trim(),
        format: cfg.format === 'individual' || cfg.format === 'either' ? cfg.format : 'team',
        evaluationCriteria: String(cfg.evaluationCriteria || 'Clarity, originality, feasibility, and live delivery.').trim(),
        submissionInstructions: String(cfg.submissionInstructions || 'Upload slide deck (PDF/PPTX) at least 30 minutes prior to your slot.').trim()
      };
    }
    if (typeKey === 'workshop') {
      return {
        sessionDuration: String(cfg.sessionDuration || fallbackDur).trim(),
        workshopInstructions: String(cfg.workshopInstructions || 'Participants should bring a laptop with required starter tools ready.').trim(),
        venueOrMeetingInfo: String(cfg.venueOrMeetingInfo || '').trim(),
        attendanceConfig: String(cfg.attendanceConfig || 'QR Check-In (Placeholder)').trim()
      };
    }
    if (typeKey === 'treasure_hunt') {
      return {
        huntDuration: String(cfg.huntDuration || fallbackDur).trim(),
        clueCount: Math.max(1, Number(cfg.clueCount) || 8),
        instructions: String(cfg.instructions || 'Solve sequential campus or digital checkpoints and log verified passcodes.').trim(),
        scoringConfig: String(cfg.scoringConfig || '10 points per solved clue + completion time tie-breaker.').trim()
      };
    }
    if (typeKey === 'puzzle') {
      return {
        puzzleCount: Math.max(1, Number(cfg.puzzleCount) || 6),
        duration: String(cfg.duration || fallbackDur).trim(),
        difficulty: String(cfg.difficulty || 'Progressive (Medium to Hard)').trim(),
        scoringConfig: String(cfg.scoringConfig || '20 points per verified puzzle solution.').trim(),
        instructions: String(cfg.instructions || '').trim()
      };
    }
    if (typeKey === 'manual') {
      return {
        evaluationCriteria: String(cfg.evaluationCriteria || 'Technical depth, originality, clarity, and execution completeness.').trim(),
        maxMarks: Math.max(1, Number(cfg.maxMarks) || 100),
        judgeInstructions: String(cfg.judgeInstructions || 'Evaluators review rubric dimensions independently before finalizing marks.').trim(),
        submissionRequirements: String(cfg.submissionRequirements || 'Project summary PDF, demo link, or repository artifact.').trim()
      };
    }
    return {
      customTypeLabel: String(cfg.customTypeLabel || '').trim(),
      duration: String(cfg.duration || fallbackDur).trim(),
      evaluationSettings: String(cfg.evaluationSettings || 'Organizer-defined stage evaluation criteria.').trim()
    };
  }

  function inferQualificationFromLegacy(eligibilityText, orderIdx) {
    const raw = String(eligibilityText || '').toLowerCase();
    if (raw.includes('shortlist')) {
      return { mode: 'shortlist', minScore: 0, sourceRoundOrder: orderIdx > 1 ? orderIdx - 1 : null, note: String(eligibilityText || '') };
    }
    if (raw.includes('min') && /\d+/.test(raw)) {
      const m = raw.match(/(\d+)/);
      return { mode: 'min_score', minScore: m ? Number(m[1]) : 50, sourceRoundOrder: orderIdx > 1 ? orderIdx - 1 : null, note: String(eligibilityText || '') };
    }
    if (raw.includes('round') || raw.includes('approved') || raw.includes('top') || raw.includes('qualif') || raw.includes('shortlist') || raw.includes('advanc')) {
      return { mode: 'previous_round', minScore: 0, sourceRoundOrder: orderIdx > 1 ? orderIdx - 1 : null, note: String(eligibilityText || '') };
    }
    return { mode: 'all', minScore: 0, sourceRoundOrder: null, note: '' };
  }

  function formatQualificationSummary(qualification, orderNum) {
    const q = qualification && typeof qualification === 'object' ? qualification : {};
    if (q.mode === 'previous_round') {
      const targetOrder = Number(q.sourceRoundOrder) || Math.max(1, (orderNum || 2) - 1);
      return orderNum === 1 ? 'Requires prior qualification' : `Qualified from Round ${targetOrder}`;
    }
    if (q.mode === 'min_score') {
      const scoreVal = Number(q.minScore);
      return `Min score >= ${Number.isFinite(scoreVal) ? scoreVal : 50} pts`;
    }
    if (q.mode === 'shortlist') {
      return 'Manual shortlist only';
    }
    return 'Open to all registered participants';
  }

  function formatScheduleDisplay(startDateTime, endDateTime, fallbackLabel) {
    function fmtOne(val) {
      if (!val) return '';
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return String(val).trim();
      return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    const s = fmtOne(startDateTime);
    const e = fmtOne(endDateTime);
    if (s && e) return `${s} – ${e}`;
    if (s) return s;
    return String(fallbackLabel || 'Schedule TBD').trim();
  }

  function normalizeRound(rawRound, idx, forceNewIds, stablePrefix) {
    const r = rawRound && typeof rawRound === 'object' ? rawRound : {};
    const order = idx + 1;
    const typeKey = mapLegacyRoundTypeKey(r.typeLabel || r.type, r.typeKey);
    const meta = getRoundTypeMeta(typeKey);
    const enabled = r.enabled !== false;

    let status = String(r.status || (enabled ? 'Scheduled' : 'Disabled')).trim();
    if (!enabled && status !== 'Disabled') {
      status = 'Disabled';
    } else if (enabled && status === 'Disabled') {
      status = 'Scheduled';
    }

    const rawQual = r.qualification && typeof r.qualification === 'object'
      ? {
          mode: QUALIFICATION_MODES.some((m) => m.key === r.qualification.mode) ? r.qualification.mode : 'all',
          minScore: Number(r.qualification.minScore) || 0,
          sourceRoundOrder: r.qualification.sourceRoundOrder ? Number(r.qualification.sourceRoundOrder) : (order > 1 ? order - 1 : null),
          note: String(r.qualification.note || '').trim()
        }
      : inferQualificationFromLegacy(r.eligibility, order);

    if (order === 1 && rawQual.mode === 'previous_round') {
      rawQual.sourceRoundOrder = null;
    }

    const typeConfig = buildTypeConfig(typeKey, r.typeConfig, r.duration);
    const customLabel = typeKey === 'custom' && typeConfig.customTypeLabel
      ? typeConfig.customTypeLabel
      : (typeKey === 'custom' && r.type && r.type !== 'Custom Stage' && r.type !== 'Custom Round' ? String(r.type) : meta.label);
    const displayTypeLabel = typeKey === 'custom'
      ? customLabel
      : (!r.typeKey && r.type ? String(r.type).trim() : meta.label);

    const rawScoring = r.scoring && typeof r.scoring === 'object'
      ? {
          enabled: Boolean(r.scoring.enabled),
          maxScore: Number(r.scoring.maxScore) || 100,
          pointsLabel: String(r.scoring.pointsLabel || 'pts').trim() || 'pts'
        }
      : {
          enabled: typeKey === 'coding' || typeKey === 'quiz' || typeKey === 'mcq' || typeKey === 'manual',
          maxScore: typeKey === 'coding' ? (typeConfig.maxScore || 300) : 100,
          pointsLabel: 'pts'
        };

    const startDateTime = String(r.startDateTime || '').trim();
    const endDateTime = String(r.endDateTime || '').trim();
    const startTime = formatScheduleDisplay(startDateTime, endDateTime, r.startTime);
    const maxParticipants = r.maxParticipants !== '' && r.maxParticipants != null && Number(r.maxParticipants) > 0
      ? Number(r.maxParticipants)
      : null;

    const eligibility = formatQualificationSummary(rawQual, order);

    const fallbackStableId = stablePrefix
      ? `rnd_${String(stablePrefix).replace(/[^a-z0-9]/gi, '_')}_${order}`
      : createRoundId();

    return {
      dbId: (!forceNewIds && r.dbId) ? String(r.dbId) : '',
      id: (!forceNewIds && r.id) ? String(r.id) : (!forceNewIds ? fallbackStableId : createRoundId()),
      order,
      name: String(r.name || `Round ${order}`).trim(),
      description: String(r.description || '').trim(),
      typeKey,
      type: displayTypeLabel,
      typeLabel: displayTypeLabel,
      status,
      enabled,
      duration: String(r.duration || (typeKey === 'coding' ? `${typeConfig.durationMinutes} Mins` : (typeConfig.timeLimitMinutes ? `${typeConfig.timeLimitMinutes} Mins` : '60 Mins'))).trim(),
      startDateTime,
      endDateTime,
      startTime,
      maxParticipants,
      venueOrOnline: String(r.venueOrOnline || '').trim(),
      instructions: String(r.instructions || '').trim(),
      scoring: { ...rawScoring },
      qualification: { ...rawQual },
      eligibility,
      typeConfig,
      updatedAt: r.updatedAt || ''
    };
  }

  function deepCloneRounds(rounds, forceNewIds, stablePrefix) {
    if (!Array.isArray(rounds)) return [];
    return rounds.map((r, idx) => normalizeRound(r, idx, Boolean(forceNewIds), stablePrefix));
  }

  function createBlankRound(typeKey, order) {
    const safeType = mapLegacyRoundTypeKey(typeKey, typeKey);
    const meta = getRoundTypeMeta(safeType);
    const num = Math.max(1, Number(order) || 1);
    const defaultsByType = {
      quiz: { name: `Quiz Screening (Round ${num})`, duration: '30 Mins', instructions: 'Answer timed quiz questions before timer expiry.' },
      coding: { name: `Coding Challenge (Round ${num})`, duration: '90 Mins', instructions: 'Solve programming tasks using any permitted language.' },
      mcq: { name: `MCQ Assessment (Round ${num})`, duration: '45 Mins', instructions: 'Complete multiple-choice questions cleanly without switching tabs.' },
      frontend: { name: `Frontend UI Build (Round ${num})`, duration: '2 Hours', instructions: 'Build responsive screens matching the design prompt and share deployment URL.' },
      presentation: { name: `Final Pitch & Demo (Round ${num})`, duration: '2 Hours', instructions: 'Deliver team presentation and answer panel Q&A within slot duration.' },
      workshop: { name: `Hands-on Workshop (Round ${num})`, duration: '90 Mins', instructions: 'Follow guided exercises and complete attendance verification.' },
      treasure_hunt: { name: `Campus Treasure Hunt (Round ${num})`, duration: '90 Mins', instructions: 'Decode sequential clues and submit verified checkpoint tokens.' },
      puzzle: { name: `Logic & Puzzle Stage (Round ${num})`, duration: '45 Mins', instructions: 'Crack analytical puzzle sets to unlock progression points.' },
      manual: { name: `Jury Evaluation Stage (Round ${num})`, duration: '3 Hours', instructions: 'Submit project deliverables for mentor and panel scoring.' },
      custom: { name: `Custom Stage (Round ${num})`, duration: '60 Mins', instructions: 'Follow stage guidelines provided by the organizing committee.' }
    };
    const preset = defaultsByType[safeType] || defaultsByType.custom;
    return normalizeRound({
      id: createRoundId(),
      order: num,
      name: preset.name,
      description: meta.description,
      typeKey: safeType,
      type: meta.label,
      status: 'Scheduled',
      enabled: true,
      duration: preset.duration,
      instructions: preset.instructions,
      qualification: {
        mode: num === 1 ? 'all' : 'previous_round',
        minScore: 0,
        sourceRoundOrder: num > 1 ? num - 1 : null,
        note: ''
      }
    }, num - 1, false);
  }

  function getRoundHighlights(rawRound) {
    const r = normalizeRound(rawRound, Math.max(0, (Number(rawRound && rawRound.order) || 1) - 1), false);
    const cfg = r.typeConfig || {};
    const chips = [];
    if (r.typeKey === 'quiz' || r.typeKey === 'mcq') {
      chips.push(`${cfg.questionCount} Questions`);
      chips.push(`+${cfg.marksPerQuestion} marks/q`);
      chips.push(cfg.negativeMarking ? `Negative -${cfg.negativeMarkValue}` : 'No negative marking');
      chips.push(`${cfg.timeLimitMinutes} min limit`);
    } else if (r.typeKey === 'coding') {
      if (Array.isArray(cfg.languages) && cfg.languages.length) {
        chips.push(cfg.languages.join(', '));
      }
      chips.push(`${cfg.problemCount} Problem(s) Placeholder`);
      chips.push(`Max ${cfg.maxScore} pts`);
      if (cfg.evaluationMode) chips.push(cfg.evaluationMode);
    } else if (r.typeKey === 'frontend') {
      if (cfg.allowedTechnologies) chips.push(`Stack: ${cfg.allowedTechnologies}`);
      if (cfg.evaluationCriteria) chips.push(`Criteria: ${cfg.evaluationCriteria}`);
    } else if (r.typeKey === 'presentation') {
      chips.push(cfg.format === 'individual' ? 'Individual' : (cfg.format === 'either' ? 'Team or Individual' : 'Team Presentation'));
      if (cfg.presentationDuration) chips.push(cfg.presentationDuration);
    } else if (r.typeKey === 'workshop') {
      if (cfg.sessionDuration) chips.push(`Session: ${cfg.sessionDuration}`);
      if (cfg.attendanceConfig) chips.push(cfg.attendanceConfig);
    } else if (r.typeKey === 'treasure_hunt') {
      chips.push(`${cfg.clueCount} Clues Placeholder`);
      if (cfg.scoringConfig) chips.push(cfg.scoringConfig);
    } else if (r.typeKey === 'puzzle') {
      chips.push(`${cfg.puzzleCount} Puzzles`);
      if (cfg.difficulty) chips.push(cfg.difficulty);
    } else if (r.typeKey === 'manual') {
      chips.push(`Max ${cfg.maxMarks} marks`);
      if (cfg.evaluationCriteria) chips.push(cfg.evaluationCriteria);
    } else {
      if (cfg.evaluationSettings) chips.push(cfg.evaluationSettings);
    }
    return chips;
  }

  function createParticipantId() {
    return `prt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function createTeamId() {
    return `tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function normalizeTeamConfig(rawCfg, participationType) {
    const cfg = rawCfg && typeof rawCfg === 'object' ? rawCfg : {};
    const supported = typeof cfg.supported === 'boolean'
      ? cfg.supported
      : String(participationType || '').toLowerCase() === 'team';
    const rawMin = Number(cfg.minSize);
    const minSize = supported ? Math.max(1, Math.min(20, Number.isFinite(rawMin) && rawMin >= 1 ? Math.floor(rawMin) : 2)) : 1;
    const rawMax = Number(cfg.maxSize);
    const maxSize = supported
      ? Math.max(minSize, Math.min(20, Number.isFinite(rawMax) && rawMax >= 1 ? Math.floor(rawMax) : Math.max(minSize, 4)))
      : 1;
    const creationMode = cfg.creationMode === 'organizer_only' ? 'organizer_only' : 'participant_allowed';
    const label = supported
      ? (minSize === maxSize ? `Teams of ${minSize} members` : `Teams of ${minSize}–${maxSize} members`)
      : 'Individual Participation';
    return {
      supported,
      minSize,
      maxSize,
      creationMode,
      allowJoinRequests: cfg.allowJoinRequests !== false,
      allowJoinExisting: cfg.allowJoinExisting !== false,
      exclusiveMembership: cfg.exclusiveMembership !== false,
      requireLeader: cfg.requireLeader !== false,
      locked: Boolean(cfg.locked),
      label
    };
  }

  function createFieldId() {
    return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function normalizeFormField(raw, idx) {
    const f = raw && typeof raw === 'object' ? raw : {};
    const validType = CUSTOM_FIELD_TYPES.some((t) => t.key === f.fieldType) ? f.fieldType : 'text';
    const rawOpts = Array.isArray(f.options)
      ? f.options
      : String(f.options || '').split(/\r?\n|,/).map((s) => s.trim());
    const options = rawOpts.map((o) => String(o || '').trim()).filter(Boolean);
    const keyBase = String(f.key || f.id || `custom_${idx + 1}`).trim();
    return {
      id: f.id ? String(f.id) : createFieldId(),
      key: keyBase,
      label: String(f.label || `Field ${idx + 1}`).trim(),
      fieldType: validType,
      helpText: String(f.helpText || '').trim(),
      required: Boolean(f.required),
      enabled: f.enabled !== false,
      isDefault: Boolean(f.isDefault),
      order: idx + 1,
      options: (validType === 'dropdown' || validType === 'multiple_choice') ? options : []
    };
  }

  function buildDefaultFormFields() {
    return DEFAULT_FORM_FIELDS.map((f, i) => normalizeFormField({ ...f, options: [...f.options] }, i));
  }

  function normalizeRegistrationConfig(rawCfg, ev) {
    const cfg = rawCfg && typeof rawCfg === 'object' ? rawCfg : {};
    const statusClosed = String((ev && ev.registrationStatus) || '').toLowerCase() === 'closed'
      || String((ev && ev.statusKey) || '') === 'cancelled'
      || String((ev && ev.statusKey) || '') === 'completed';
    const registrationEnabled = typeof cfg.registrationEnabled === 'boolean' ? cfg.registrationEnabled : !statusClosed;
    const rawMax = Number(cfg.maxRegistrations != null ? cfg.maxRegistrations : (ev && ev.capacity != null ? ev.capacity : 200));
    const maxRegistrations = Math.max(1, Number.isFinite(rawMax) ? Math.floor(rawMax) : 200);
    const capacityEnabled = typeof cfg.capacityEnabled === 'boolean' ? cfg.capacityEnabled : true;
    const approvalMode = cfg.approvalMode === 'manual' ? 'manual' : 'auto';
    const formFieldsRaw = Array.isArray(cfg.formFields) && cfg.formFields.length ? cfg.formFields : buildDefaultFormFields();
    const seenKeys = new Set();
    const formFields = formFieldsRaw
      .map((f, i) => normalizeFormField(f, i))
      .filter((f) => {
        if (seenKeys.has(f.id)) return false;
        seenKeys.add(f.id);
        return true;
      });
    // Ensure default fields exist cleanly if missing in partial config
    if (!cfg.formFields || !cfg.formFields.length) {
      // already defaults
    } else {
      DEFAULT_FORM_FIELDS.forEach((def) => {
        if (!formFields.some((f) => f.key === def.key)) {
          formFields.push(normalizeFormField({ ...def, options: [...def.options], enabled: false }, formFields.length));
        }
      });
    }
    return {
      registrationEnabled,
      registrationOpensAt: String(cfg.registrationOpensAt || '').trim(),
      registrationClosesAt: String(cfg.registrationClosesAt || '').trim(),
      maxRegistrations,
      capacityEnabled,
      waitlistEnabled: Boolean(cfg.waitlistEnabled),
      approvalMode,
      cancellationAllowed: cfg.cancellationAllowed !== false,
      cancellationDeadline: String(cfg.cancellationDeadline || '').trim(),
      registrationInstructions: String(cfg.registrationInstructions || 'Review event schedule, confirm your details, and follow organizer instructions carefully.').trim(),
      confirmationMessage: String(cfg.confirmationMessage || 'Your local Eventora registration pass is recorded. Check My Registrations inside your dashboard anytime.').trim(),
      formFields: formFields.map((f, idx) => ({ ...f, order: idx + 1, options: [...f.options] }))
    };
  }

  function normalizeParticipant(raw, eventSlug, idx) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const status = REGISTRATION_STATUSES.includes(p.registrationStatus) ? p.registrationStatus : 'Pending';
    const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
    const subData = p.submittedData && typeof p.submittedData === 'object' ? { ...p.submittedData } : {};
    const pid = p.id ? String(p.id) : createParticipantId();
    const cleanInst = String(subData.institution || meta.institution || p.institution || '').trim();
    const cleanDept = String(subData.department || meta.department || '').trim();
    const cleanCity = String(subData.city || meta.city || '').trim();
    const cleanPhone = String(subData.phone || meta.phone || '').trim();
    return {
      dbId: p.dbId ? String(p.dbId) : '',
      id: pid,
      participantId: pid,
      eventId: String(eventSlug || p.eventId || ''),
      userId: p.userId ? String(p.userId) : null,
      fullName: String(p.fullName || p.name || subData.fullName || `Participant ${idx + 1}`).trim(),
      email: String(p.email || subData.email || '').trim().toLowerCase(),
      registrationId: String(p.registrationId || `REG-${String(idx + 101).padStart(4, '0')}`).trim().toUpperCase(),
      registrationStatus: status,
      registeredAt: String(p.registeredAt || new Date().toISOString()),
      updatedAt: String(p.updatedAt || p.registeredAt || new Date().toISOString()),
      teamId: p.teamId ? String(p.teamId) : null,
      isDemo: Boolean(p.isDemo),
      participationChoice: String(p.participationChoice || '').trim(),
      teamRequestNote: String(p.teamRequestNote || '').trim(),
      submittedData: subData,
      cancellation: p.cancellation && typeof p.cancellation === 'object'
        ? {
            cancelledAt: String(p.cancellation.cancelledAt || ''),
            reason: String(p.cancellation.reason || '').trim()
          }
        : null,
      metadata: {
        institution: cleanInst,
        department: cleanDept,
        city: cleanCity,
        phone: cleanPhone,
        yearOfStudy: String(subData.yearOfStudy || meta.yearOfStudy || '').trim(),
        participantType: String(subData.participantType || meta.participantType || '').trim(),
        track: String(meta.track || '').trim(),
        notes: String(meta.notes || '').trim()
      }
    };
  }

  function normalizeTeam(raw, eventSlug, idx, fallbackMaxSize) {
    const t = raw && typeof raw === 'object' ? raw : {};
    const maxCap = Math.max(1, Math.min(20, Number(t.maxTeamSize) || Number(fallbackMaxSize) || 4));
    const seen = new Set();
    const memberIds = (Array.isArray(t.memberIds) ? t.memberIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    const leaderId = t.teamLeaderId && seen.has(String(t.teamLeaderId)) ? String(t.teamLeaderId) : null;
    const status = TEAM_STATUSES.includes(t.status) ? t.status : 'Active';
    return {
      dbId: t.dbId ? String(t.dbId) : '',
      id: t.id ? String(t.id) : createTeamId(),
      eventId: String(eventSlug || t.eventId || ''),
      teamName: String(t.teamName || t.name || `Team ${idx + 1}`).trim(),
      teamCode: String(t.teamCode || t.code || '').trim(),
      description: String(t.description || '').trim(),
      leaderUserId: t.leaderUserId ? String(t.leaderUserId) : '',
      teamLeaderId: leaderId,
      memberIds,
      memberUserIds: Array.isArray(t.memberUserIds) ? [...t.memberUserIds] : [],
      maxTeamSize: maxCap,
      status,
      createdAt: String(t.createdAt || new Date().toISOString()),
      isDemo: Boolean(t.isDemo)
    };
  }

  function reconcileEventRoster(rawParticipants, rawTeams, eventSlug, teamConfig) {
    const participants = (Array.isArray(rawParticipants) ? rawParticipants : []).map((p, i) => normalizeParticipant(p, eventSlug, i));
    const pMap = new Map();
    participants.forEach((p) => {
      p.teamId = null;
      pMap.set(p.id, p);
    });

    const assignedGlobal = new Set();
    const exclusive = teamConfig.exclusiveMembership !== false;
    const minSize = teamConfig.minSize || 1;
    const maxAllowedCap = teamConfig.maxSize || 4;

    const teams = (Array.isArray(rawTeams) ? rawTeams : []).map((rawT, idx) => {
      const t = normalizeTeam(rawT, eventSlug, idx, maxAllowedCap);
      const validMembers = [];
      t.memberIds.forEach((mid) => {
        if (!pMap.has(mid)) return;
        if (exclusive && assignedGlobal.has(mid)) return;
        if (validMembers.length >= t.maxTeamSize) return;
        validMembers.push(mid);
        assignedGlobal.add(mid);
        const pObj = pMap.get(mid);
        if (pObj && !pObj.teamId) {
          pObj.teamId = t.id;
        }
      });
      t.memberIds = validMembers;
      if (!t.teamLeaderId || !validMembers.includes(t.teamLeaderId)) {
        t.teamLeaderId = null;
      }
      if (teamConfig.locked) {
        t.status = 'Locked';
      } else if (validMembers.length >= t.maxTeamSize) {
        t.status = 'Full';
      } else if (validMembers.length < minSize) {
        t.status = 'Awaiting Members';
      } else {
        t.status = 'Active';
      }
      return t;
    });

    return { participants, teams };
  }

  function createLiveActivityId() {
    return `lact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function createAnnouncementId() {
    return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function formatActorRef(actor) {
    if (!actor || typeof actor !== 'object') {
      return { actorId: 'organizer-local', actorName: 'Organizer' };
    }
    const actorId = String(actor.id || actor.email || 'organizer-local');
    const actorName = String(actor.name || actor.fullName || actor.email || 'Organizer').trim();
    return { actorId, actorName };
  }

  function parseDurationToSeconds(round) {
    if (!round || typeof round !== 'object') return 0;
    const raw = String(round.duration || '').trim().toLowerCase();
    if (raw === 'untimed' || raw === 'flexible' || raw === 'no timer' || raw === 'none') return 0;

    let totalSeconds = 0;
    if (raw) {
      const dayMatches = raw.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)\b/gi) || [];
      const hrMatches = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/gi) || [];
      const minMatches = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/gi) || [];
      const secMatches = raw.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/gi) || [];
      dayMatches.forEach((m) => { totalSeconds += parseFloat(m) * 86400; });
      hrMatches.forEach((m) => { totalSeconds += parseFloat(m) * 3600; });
      minMatches.forEach((m) => { totalSeconds += parseFloat(m) * 60; });
      secMatches.forEach((m) => { totalSeconds += parseFloat(m); });
      if (totalSeconds === 0 && /^\d+(?:\.\d+)?$/.test(raw)) {
        totalSeconds = Math.round(parseFloat(raw) * 60);
      }
    }

    if (totalSeconds <= 0 && round.typeConfig && typeof round.typeConfig === 'object') {
      const tc = round.typeConfig;
      const mins = Number(tc.timeLimitMinutes || tc.durationMinutes || 0);
      if (Number.isFinite(mins) && mins > 0) {
        totalSeconds = Math.round(mins * 60);
      }
    }

    return Math.max(0, Math.round(totalSeconds));
  }

  function computeTimerSnapshot(roundOp, nowMsInput) {
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const baseDurationSeconds = Math.max(0, Number(roundOp && roundOp.durationSeconds) || 0);
    const extensions = Array.isArray(roundOp && roundOp.extensionHistory) ? roundOp.extensionHistory : [];
    const addedExtensionSeconds = extensions.reduce((sum, item) => sum + Math.max(0, Number(item && item.addedSeconds) || 0), 0);
    const totalDurationSeconds = Math.max(0, baseDurationSeconds + addedExtensionSeconds);
    const hasDuration = totalDurationSeconds > 0;
    const totalDurationMs = totalDurationSeconds * 1000;
    const lowTimeThresholdSeconds = hasDuration
      ? Math.min(300, Math.max(15, Math.floor(totalDurationSeconds * 0.2)))
      : 0;

    const rawState = LIVE_TIMER_STATES.includes(roundOp && roundOp.timerState) ? roundOp.timerState : 'Idle';
    if (!roundOp || rawState === 'Idle' || !roundOp.startedAt) {
      return {
        state: 'Idle',
        hasDuration,
        baseDurationSeconds,
        addedExtensionSeconds,
        totalDurationSeconds,
        elapsedSeconds: 0,
        remainingSeconds: totalDurationSeconds,
        rawElapsedMs: 0,
        remainingMs: totalDurationMs,
        lowTimeThresholdSeconds,
        isLowTime: false,
        isExpired: false
      };
    }

    const startedMsParsed = Date.parse(roundOp.startedAt);
    const startedMs = Number.isNaN(startedMsParsed) ? nowMs : startedMsParsed;
    const accPausedMs = Math.max(0, Number(roundOp.accumulatedPausedMs) || 0);

    let rawElapsedMs = 0;
    if (rawState === 'Paused' && roundOp.pausedAt) {
      const pParsed = Date.parse(roundOp.pausedAt);
      const pausedMs = Number.isNaN(pParsed) ? nowMs : pParsed;
      rawElapsedMs = Math.max(0, pausedMs - startedMs - accPausedMs);
    } else if (rawState === 'Ended' || rawState === 'Expired') {
      if (roundOp.endedAt) {
        const eParsed = Date.parse(roundOp.endedAt);
        const endedMs = Number.isNaN(eParsed) ? nowMs : eParsed;
        rawElapsedMs = Math.max(0, endedMs - startedMs - accPausedMs);
      } else if (rawState === 'Expired' && hasDuration) {
        rawElapsedMs = totalDurationMs;
      } else {
        const snapRem = Number(roundOp.remainingSecondsSnapshot);
        rawElapsedMs = Number.isFinite(snapRem) && hasDuration
          ? Math.max(0, totalDurationMs - snapRem * 1000)
          : Math.max(0, nowMs - startedMs - accPausedMs);
      }
    } else {
      rawElapsedMs = Math.max(0, nowMs - startedMs - accPausedMs);
    }

    if (hasDuration) {
      const remainingMs = Math.max(0, totalDurationMs - rawElapsedMs);
      const remainingSeconds = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
      const elapsedSeconds = Math.min(totalDurationSeconds, Math.floor(rawElapsedMs / 1000));
      const isExpired = rawState === 'Expired' || (rawState === 'Running' && remainingMs <= 0) || (rawState === 'Paused' && remainingMs <= 0 && Boolean(roundOp.expiredNoticeLogged));
      const effectiveState = isExpired && rawState !== 'Ended' ? 'Expired' : rawState;
      const isLowTime = (effectiveState === 'Running' || effectiveState === 'Paused')
        && remainingSeconds > 0
        && remainingSeconds <= lowTimeThresholdSeconds;
      return {
        state: effectiveState,
        hasDuration: true,
        baseDurationSeconds,
        addedExtensionSeconds,
        totalDurationSeconds,
        elapsedSeconds,
        remainingSeconds,
        rawElapsedMs,
        remainingMs,
        lowTimeThresholdSeconds,
        isLowTime,
        isExpired
      };
    }

    return {
      state: rawState,
      hasDuration: false,
      baseDurationSeconds: 0,
      addedExtensionSeconds,
      totalDurationSeconds: 0,
      elapsedSeconds: Math.max(0, Math.floor(rawElapsedMs / 1000)),
      remainingSeconds: 0,
      rawElapsedMs,
      remainingMs: 0,
      lowTimeThresholdSeconds: 0,
      isLowTime: false,
      isExpired: rawState === 'Expired'
    };
  }

  function normalizeRoundOp(rawOp, round, eventSlug, validParticipantIds, validTeamIds) {
    const op = rawOp && typeof rawOp === 'object' ? rawOp : {};
    const parsedDur = parseDurationToSeconds(round);
    let roundStatus = LIVE_ROUND_STATUSES.includes(op.roundStatus) ? op.roundStatus : 'Upcoming';
    if (round.status === 'Disabled' || round.enabled === false) {
      if (roundStatus !== 'Completed') roundStatus = 'Cancelled';
    } else if (roundStatus === 'Cancelled' && round.enabled !== false && round.status !== 'Disabled') {
      if (!op.manuallyCancelled) roundStatus = 'Upcoming';
    }

    const durationSeconds = (op.startedAt || roundStatus !== 'Upcoming') && Number.isFinite(Number(op.durationSeconds))
      ? Math.max(0, Math.round(Number(op.durationSeconds)))
      : parsedDur;

    const timerState = LIVE_TIMER_STATES.includes(op.timerState) ? op.timerState : 'Idle';

    const extensionHistory = Array.isArray(op.extensionHistory)
      ? op.extensionHistory
          .filter((x) => x && typeof x === 'object' && Number(x.addedSeconds) > 0)
          .map((x, idx) => ({
            id: String(x.id || `ext_${idx + 1}`),
            addedSeconds: Math.round(Number(x.addedSeconds)),
            reason: String(x.reason || 'Organizer extension').trim(),
            addedAt: String(x.addedAt || ''),
            actorId: String(x.actorId || 'organizer-local')
          }))
      : [];

    const pStatusesRaw = op.participantStatuses && typeof op.participantStatuses === 'object' ? op.participantStatuses : {};
    const participantStatuses = {};
    Object.keys(pStatusesRaw).forEach((pid) => {
      const val = pStatusesRaw[pid];
      if (validParticipantIds.has(pid) && LIVE_PARTICIPATION_STATUSES.includes(val)) {
        participantStatuses[pid] = val;
      }
    });

    const tStatusesRaw = op.teamStatuses && typeof op.teamStatuses === 'object' ? op.teamStatuses : {};
    const teamStatuses = {};
    Object.keys(tStatusesRaw).forEach((tid) => {
      const val = tStatusesRaw[tid];
      if (validTeamIds.has(tid) && LIVE_PARTICIPATION_STATUSES.includes(val)) {
        teamStatuses[tid] = val;
      }
    });

    const presentationOrder = Array.isArray(op.presentationOrder)
      ? op.presentationOrder
          .filter((entry) => entry && typeof entry === 'object' && entry.refId && (
            (entry.kind === 'team' && validTeamIds.has(entry.refId))
            || (entry.kind === 'participant' && validParticipantIds.has(entry.refId))
          ))
          .map((entry, idx) => ({
            key: String(entry.key || `${entry.kind}:${entry.refId}`),
            kind: entry.kind === 'team' ? 'team' : 'participant',
            refId: String(entry.refId),
            label: String(entry.label || `Slot ${idx + 1}`).trim(),
            slotMinutes: Math.max(1, Number(entry.slotMinutes) || 8),
            status: LIVE_PARTICIPATION_STATUSES.includes(entry.status) ? entry.status : 'Not Started',
            notes: String(entry.notes || '').trim()
          }))
      : [];

    return {
      roundId: String(round.id),
      eventId: String(eventSlug || ''),
      roundStatus,
      timerState,
      startedAt: String(op.startedAt || ''),
      pausedAt: String(op.pausedAt || ''),
      endedAt: String(op.endedAt || ''),
      accumulatedPausedMs: Math.max(0, Number(op.accumulatedPausedMs) || 0),
      durationSeconds,
      remainingSecondsSnapshot: Number.isFinite(Number(op.remainingSecondsSnapshot))
        ? Math.max(0, Math.round(Number(op.remainingSecondsSnapshot)))
        : durationSeconds,
      extensionHistory,
      participantStatuses,
      teamStatuses,
      presentationOrder,
      pausedByEventPause: Boolean(op.pausedByEventPause),
      manuallyCancelled: Boolean(op.manuallyCancelled),
      expiredNoticeLogged: Boolean(op.expiredNoticeLogged),
      roundEndedAwaitingCompletion: Boolean(op.roundEndedAwaitingCompletion)
    };
  }

  function normalizeAnnouncement(rawAnn, eventSlug, idx) {
    const a = rawAnn && typeof rawAnn === 'object' ? rawAnn : {};
    const status = a.status === 'Published' ? 'Published' : 'Draft';
    const createdAt = String(a.createdAt || new Date().toISOString());
    return {
      id: String(a.id || createAnnouncementId()),
      eventId: String(eventSlug || a.eventId || ''),
      roundId: String(a.roundId || ''),
      template: String(a.template || 'Custom Announcement').trim(),
      title: String(a.title || `Announcement ${idx + 1}`).trim(),
      message: String(a.message || '').trim(),
      status,
      createdAt,
      updatedAt: String(a.updatedAt || createdAt),
      publishedAt: status === 'Published' ? String(a.publishedAt || a.updatedAt || createdAt) : '',
      authorId: String(a.authorId || 'organizer-local'),
      authorName: String(a.authorName || 'Organizer').trim()
    };
  }

  function normalizeLiveActivityEntry(rawAct, eventSlug, idx) {
    const a = rawAct && typeof rawAct === 'object' ? rawAct : {};
    return {
      id: String(a.id || `lact_${idx + 1}`),
      eventId: String(eventSlug || a.eventId || ''),
      roundId: a.roundId ? String(a.roundId) : null,
      activityType: String(a.activityType || 'operation').trim(),
      description: String(a.description || 'Event operation recorded').trim(),
      timestamp: String(a.timestamp || new Date().toISOString()),
      actorId: String(a.actorId || 'organizer-local'),
      actorName: String(a.actorName || 'Organizer').trim()
    };
  }

  function normalizeLiveOps(rawOps, ev) {
    const ops = rawOps && typeof rawOps === 'object' ? rawOps : {};
    const eventSlug = String((ev && ev.slug) || ops.eventId || '');
    const rounds = Array.isArray(ev && ev.rounds) ? ev.rounds : [];
    const participants = Array.isArray(ev && ev.participants) ? ev.participants : [];
    const teams = Array.isArray(ev && ev.teams) ? ev.teams : [];
    const validParticipantIds = new Set(participants.map((p) => p.id));
    const validTeamIds = new Set(teams.map((t) => t.id));
    const rawRoundsMap = ops.roundsById && typeof ops.roundsById === 'object' ? ops.roundsById : {};

    const roundsById = {};
    const activeRoundIdSet = new Set();
    rounds.forEach((round) => {
      if (!round || !round.id || activeRoundIdSet.has(round.id)) return;
      activeRoundIdSet.add(round.id);
      roundsById[round.id] = normalizeRoundOp(rawRoundsMap[round.id], round, eventSlug, validParticipantIds, validTeamIds);
    });

    // Preserve historical completed snapshots if a completed round was removed in Round Builder.
    const archivedCompletedRounds = Array.isArray(ops.archivedCompletedRounds)
      ? ops.archivedCompletedRounds.map((x) => ({ ...x }))
      : [];
    Object.keys(rawRoundsMap).forEach((rid) => {
      const candidate = rawRoundsMap[rid];
      if (!activeRoundIdSet.has(rid) && candidate && candidate.roundStatus === 'Completed') {
        if (!archivedCompletedRounds.some((a) => a.roundId === rid)) {
          archivedCompletedRounds.push({
            roundId: rid,
            roundStatus: 'Completed',
            endedAt: String(candidate.endedAt || ''),
            startedAt: String(candidate.startedAt || ''),
            archivedAt: new Date().toISOString()
          });
        }
      }
    });

    let operationalStatus = LIVE_EVENT_STATUSES.includes(ops.operationalStatus) ? ops.operationalStatus : 'Upcoming';
    if (!ops.operationalStatus && ev && ev.statusKey === 'completed') {
      operationalStatus = 'Completed';
    }

    let currentRoundId = ops.currentRoundId && activeRoundIdSet.has(ops.currentRoundId) ? String(ops.currentRoundId) : null;
    if (!currentRoundId || (roundsById[currentRoundId] && roundsById[currentRoundId].roundStatus === 'Completed')) {
      const activeRound = rounds.find((r) => roundsById[r.id] && (roundsById[r.id].roundStatus === 'Live' || roundsById[r.id].roundStatus === 'Paused'));
      currentRoundId = activeRound ? activeRound.id : null;
    }

    const announcements = Array.isArray(ops.announcements)
      ? ops.announcements.map((a, idx) => normalizeAnnouncement(a, eventSlug, idx))
      : [];

    const activityTimeline = Array.isArray(ops.activityTimeline)
      ? ops.activityTimeline.map((a, idx) => normalizeLiveActivityEntry(a, eventSlug, idx))
      : [];

    return {
      eventId: eventSlug,
      operationalStatus,
      currentRoundId,
      allowConcurrentRounds: Boolean(ops.allowConcurrentRounds),
      roundsById,
      archivedCompletedRounds,
      announcements,
      activityTimeline: activityTimeline.slice(0, 120),
      operationsUpdatedAt: String(ops.operationsUpdatedAt || ''),
      completedAt: operationalStatus === 'Completed' ? String(ops.completedAt || '') : ''
    };
  }

  function deriveStatusKey(ev) {
    if (ev && ev.statusKey && STATUS_META[ev.statusKey]) return ev.statusKey;
    const raw = String((ev && ev.eventStatus) || '').toLowerCase();
    if (raw.includes('draft')) return 'draft';
    if (raw.includes('ongoing') || raw.includes('live')) return 'ongoing';
    if (raw.includes('complete')) return 'completed';
    if (raw.includes('cancel')) return 'cancelled';
    return 'published';
  }

  function normalizeEvent(ev) {
    if (!ev) return null;
    const statusKey = deriveStatusKey(ev);
    const meta = STATUS_META[statusKey] || STATUS_META.published;
    const rounds = deepCloneRounds(Array.isArray(ev.rounds) ? ev.rounds : [], false, ev.slug || ev.name || 'ev');
    const partType = ev.participationType === 'team' || (!ev.participationType && ev.teamConfig && ev.teamConfig.supported) ? 'team' : (ev.participationType || 'individual');
    const teamConfig = normalizeTeamConfig(ev.teamConfig, partType);
    const registrationConfig = normalizeRegistrationConfig(ev.registrationConfig, { ...ev, statusKey });
    const reconciled = reconcileEventRoster(ev.participants, ev.teams, ev.slug, teamConfig);
    const nonCancelledCount = reconciled.participants.filter((p) => p.registrationStatus !== 'Cancelled').length;
    const normalizedBase = {
      ...ev,
      participationType: teamConfig.supported ? 'team' : 'individual',
      statusKey,
      eventStatus: ev.eventStatus || meta.label,
      statusBadgeClass: meta.badgeClass,
      visibility: ev.visibility || (statusKey === 'draft' ? 'private' : 'public'),
      capacity: registrationConfig.maxRegistrations,
      registrationDeadline: ev.registrationDeadline || 'Open until event start',
      registrationCount: nonCancelledCount,
      participants: reconciled.participants,
      teams: reconciled.teams,
      rounds,
      schedule: Array.isArray(ev.schedule) ? ev.schedule.map((s) => ({ ...s })) : [],
      rules: Array.isArray(ev.rules) ? [...ev.rules] : [],
      organizers: Array.isArray(ev.organizers) ? ev.organizers.map((o) => ({ ...o })) : [],
      faqs: Array.isArray(ev.faqs) ? ev.faqs.map((f) => ({ ...f })) : [],
      teamConfig,
      registrationConfig,
      roundConfigUpdatedAt: ev.roundConfigUpdatedAt || '',
      rosterUpdatedAt: ev.rosterUpdatedAt || '',
      createdAt: ev.createdAt || ev.startTimeISO || '2026-11-20T09:00:00'
    };
    normalizedBase.liveOps = normalizeLiveOps(ev.liveOps, normalizedBase);
    normalizedBase.roundContentById = normalizeEventRoundContent(ev.roundContentById, normalizedBase);
    normalizedBase.evaluationState = normalizeEvaluationState(ev.evaluationState, normalizedBase);
    return normalizedBase;
  }

  function createContentItemId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function validatePdfDescriptor(fileMeta) {
    const f = fileMeta && typeof fileMeta === 'object' ? fileMeta : {};
    const fileName = String(f.fileName || f.name || '').trim();
    const mimeType = String(f.mimeType || f.type || '').trim().toLowerCase();
    const sizeBytes = Number(f.sizeBytes != null ? f.sizeBytes : f.size);
    const isPdfMime = mimeType === 'application/pdf' || mimeType === 'application/x-pdf';
    const hasPdfExt = /\.pdf$/i.test(fileName);
    if (!fileName) {
      return { ok: false, error: 'Missing file name for PDF upload.' };
    }
    if (!isPdfMime && !hasPdfExt) {
      return { ok: false, error: 'Only PDF documents (.pdf) are allowed.' };
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return { ok: false, error: 'Selected PDF file is empty or unreadable.' };
    }
    if (sizeBytes > MAX_PDF_BYTES) {
      return {
        ok: false,
        error: `PDF exceeds 20 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB).`
      };
    }
    return { ok: true, fileName, mimeType: 'application/pdf', sizeBytes: Math.round(sizeBytes) };
  }

  function normalizeRoundPdf(rawPdf, round, idx) {
    const p = rawPdf && typeof rawPdf === 'object' ? rawPdf : {};
    const category = PDF_CATEGORIES.includes(p.category) ? p.category : 'Question Paper';
    const fileId = String(p.fileId || '').trim();
    // Avoid bloating sessionStorage when binary lives in IndexedDB (`fileId`).
    const rawData = (!fileId && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:'))
      ? p.dataUrl
      : (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:') && p.dataUrl.length < 180000 ? p.dataUrl : '');
    const fileName = String(p.fileName || `round-document-${idx + 1}.pdf`).trim();
    return {
      dbId: String(p.dbId || '').trim(),
      id: String(p.id || createContentItemId('pdf')),
      fileId,
      storagePath: String(p.storagePath || '').trim(),
      category,
      title: String(p.title || fileName.replace(/\.pdf$/i, '') || `Document ${idx + 1}`).trim(),
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: Math.max(0, Math.round(Number(p.sizeBytes) || 0)),
      uploadedAt: String(p.uploadedAt || new Date().toISOString()),
      updatedAt: String(p.updatedAt || p.uploadedAt || new Date().toISOString()),
      dataUrl: rawData,
      description: String(p.description || '').trim(),
      instructions: String(p.instructions || '').trim(),
      totalMarks: p.totalMarks !== '' && p.totalMarks != null && Number.isFinite(Number(p.totalMarks))
        ? Math.max(0, Number(p.totalMarks))
        : (round && round.scoring ? Number(round.scoring.maxScore) || 0 : 0),
      duration: String(p.duration || (round ? round.duration : '') || '').trim(),
      questionCount: p.questionCount !== '' && p.questionCount != null && Number(p.questionCount) >= 0
        ? Math.round(Number(p.questionCount))
        : null
    };
  }

  function normalizeRoundAttachment(rawAtt, idx) {
    const a = rawAtt && typeof rawAtt === 'object' ? rawAtt : {};
    const fileId = String(a.fileId || '').trim();
    const rawData = (!fileId && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:'))
      ? a.dataUrl
      : (typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:') && a.dataUrl.length < 120000 ? a.dataUrl : '');
    const fileName = String(a.fileName || `attachment-${idx + 1}`).trim();
    return {
      dbId: String(a.dbId || '').trim(),
      id: String(a.id || createContentItemId('att')),
      fileId,
      storagePath: String(a.storagePath || '').trim(),
      category: ATTACHMENT_CATEGORIES.includes(a.category) ? a.category : 'Additional Material',
      title: String(a.title || fileName || `Attachment ${idx + 1}`).trim(),
      fileName,
      mimeType: String(a.mimeType || 'application/octet-stream').trim(),
      sizeBytes: Math.max(0, Math.round(Number(a.sizeBytes) || 0)),
      dataUrl: rawData,
      description: String(a.description || '').trim(),
      visibility: a.visibility === 'organizer_only' ? 'organizer_only' : 'when_unlocked',
      uploadedAt: String(a.uploadedAt || new Date().toISOString())
    };
  }

  function normalizeRoundQuestion(rawQ, idx) {
    const q = rawQ && typeof rawQ === 'object' ? rawQ : {};
    const qType = QUESTION_TYPES.some((t) => t.key === q.questionType) ? q.questionType : 'mcq';
    let options = Array.isArray(q.options)
      ? q.options.map((o) => String(o == null ? '' : o).trim()).filter(Boolean)
      : [];
    if (qType === 'true_false') {
      options = ['True', 'False'];
    } else if ((qType === 'mcq' || qType === 'mcq_multi') && options.length < 2) {
      while (options.length < 2) options.push(`Option ${options.length + 1}`);
    }
    const rawIdx = q.correctOptionIndex != null && q.correctOptionIndex !== '' ? Number(q.correctOptionIndex) : 0;
    const correctOptionIndex = (qType === 'mcq' || qType === 'true_false') && options.length > 0
      ? Math.max(0, Math.min(options.length - 1, Math.floor(Number.isFinite(rawIdx) ? rawIdx : 0)))
      : null;
    let correctOptionIndices = [];
    if (qType === 'mcq_multi') {
      const seenI = new Set();
      const rawArr = Array.isArray(q.correctOptionIndices) ? q.correctOptionIndices : [correctOptionIndex != null ? correctOptionIndex : 0];
      rawArr.forEach((v) => {
        const n = Math.floor(Number(v));
        if (Number.isFinite(n) && n >= 0 && n < options.length && !seenI.has(n)) {
          seenI.add(n);
          correctOptionIndices.push(n);
        }
      });
      if (!correctOptionIndices.length && options.length > 0) correctOptionIndices = [0];
      correctOptionIndices.sort((a, b) => a - b);
    }

    return {
      id: String(q.id || createContentItemId('qst')),
      order: idx + 1,
      questionType: qType,
      prompt: String(q.prompt || q.question || '').trim(),
      codeSnippet: String(q.codeSnippet || '').trim(),
      options,
      correctOptionIndex,
      correctOptionIndices,
      acceptedAnswer: qType === 'short_answer' ? String(q.acceptedAnswer || q.answer || '').trim() : '',
      explanation: String(q.explanation || '').trim(),
      marks: Math.max(0, Number.isFinite(Number(q.marks)) ? Number(q.marks) : 1),
      negativeMarks: Math.max(0, Number.isFinite(Number(q.negativeMarks)) ? Number(q.negativeMarks) : 0),
      mandatory: q.mandatory !== false,
      imageFileId: String(q.imageFileId || '').trim(),
      imageName: String(q.imageName || '').trim(),
      imageDataUrl: (!q.imageFileId && typeof q.imageDataUrl === 'string' && q.imageDataUrl.startsWith('data:image/'))
        ? q.imageDataUrl
        : (typeof q.imageDataUrl === 'string' && q.imageDataUrl.startsWith('data:image/') && q.imageDataUrl.length < 100000 ? q.imageDataUrl : ''),
      difficulty: DIFFICULTY_LEVELS.includes(q.difficulty) ? q.difficulty : 'Medium',
      tags: Array.isArray(q.tags) ? q.tags.map((t) => String(t || '').trim()).filter(Boolean) : [],
      createdAt: String(q.createdAt || new Date().toISOString()),
      updatedAt: String(q.updatedAt || new Date().toISOString())
    };
  }

  function normalizeCodingProblem(rawProb, idx) {
    const c = rawProb && typeof rawProb === 'object' ? rawProb : {};
    const langsRaw = Array.isArray(c.allowedLanguages) && c.allowedLanguages.length
      ? c.allowedLanguages
      : CODING_LANGUAGES;
    return {
      dbId: String(c.dbId || '').trim(),
      id: String(c.id || createContentItemId('prb')),
      order: idx + 1,
      problemTitle: String(c.problemTitle || c.title || `Problem ${idx + 1}`).trim(),
      difficulty: DIFFICULTY_LEVELS.includes(c.difficulty) ? c.difficulty : 'Medium',
      points: Math.max(1, Math.round(Number(c.points) || 100)),
      timeLimit: String(c.timeLimit || '2 Seconds').trim(),
      statement: String(c.statement || '').trim(),
      inputFormat: String(c.inputFormat || '').trim(),
      outputFormat: String(c.outputFormat || '').trim(),
      constraints: String(c.constraints || '').trim(),
      sampleInput: String(c.sampleInput || ''),
      sampleOutput: String(c.sampleOutput || ''),
      explanation: String(c.explanation || '').trim(),
      evaluationRubric: String(c.evaluationRubric || '').trim(),
      submissionInstructions: String(c.submissionInstructions || '').trim(),
      problemPdfFileId: String(c.problemPdfFileId || '').trim(),
      problemPdfPath: String(c.problemPdfPath || '').trim(),
      problemPdfName: String(c.problemPdfName || '').trim(),
      attachments: Array.isArray(c.attachments) ? c.attachments.map((a, i) => normalizeRoundAttachment(a, i)) : [],
      allowedLanguages: langsRaw.map((l) => String(l || '').trim()).filter(Boolean),
      starterUrl: String(c.starterUrl || '').trim(),
      assetsNote: String(c.assetsNote || '').trim(),
      updatedAt: String(c.updatedAt || new Date().toISOString())
    };
  }

  function normalizeRoundMaterial(rawMat, idx) {
    const m = rawMat && typeof rawMat === 'object' ? rawMat : {};
    const category = MATERIAL_CATEGORIES.includes(m.category) ? m.category : 'Prompt / Brief';
    const vis = m.visibility === 'organizer_only' ? 'organizer_only' : 'when_unlocked';
    return {
      id: String(m.id || createContentItemId('mat')),
      category,
      title: String(m.title || `Material ${idx + 1}`).trim(),
      description: String(m.description || '').trim(),
      resourceUrl: String(m.resourceUrl || '').trim(),
      visibility: vis,
      updatedAt: String(m.updatedAt || new Date().toISOString())
    };
  }

  function inferDefaultContentStatus(rawPkg, hasAnyContent) {
    if (rawPkg && CONTENT_STATUSES.includes(rawPkg.contentStatus)) {
      if (rawPkg.contentStatus === 'No Content' && hasAnyContent) return 'Draft';
      return rawPkg.contentStatus;
    }
    return hasAnyContent ? 'Draft' : 'No Content';
  }

  function normalizeRoundContentPackage(rawPkg, round, eventSlug) {
    const c = rawPkg && typeof rawPkg === 'object' ? rawPkg : {};
    const pdfs = Array.isArray(c.pdfs) ? c.pdfs.map((p, idx) => normalizeRoundPdf(p, round, idx)) : [];
    const questions = Array.isArray(c.questions)
      ? c.questions.map((q, idx) => normalizeRoundQuestion(q, idx)).filter((q) => Boolean(q.prompt))
      : [];
    const codingProblems = Array.isArray(c.codingProblems)
      ? c.codingProblems.map((p, idx) => normalizeCodingProblem(p, idx)).filter((p) => Boolean(p.problemTitle))
      : [];
    const materials = Array.isArray(c.materials)
      ? c.materials.map((m, idx) => normalizeRoundMaterial(m, idx)).filter((m) => Boolean(m.title || m.description))
      : [];
    const attachments = Array.isArray(c.attachments)
      ? c.attachments.map((a, idx) => normalizeRoundAttachment(a, idx))
      : [];

    const chRaw = c.challengeSpec && typeof c.challengeSpec === 'object' ? c.challengeSpec : {};
    const challengeSpec = {
      taskDescription: String(chRaw.taskDescription || '').trim(),
      submissionRequirements: String(chRaw.submissionRequirements || '').trim(),
      evaluationGuidelines: String(chRaw.evaluationGuidelines || '').trim(),
      allowRepoUrl: chRaw.allowRepoUrl !== false,
      allowLiveUrl: chRaw.allowLiveUrl !== false,
      allowFileAttachment: chRaw.allowFileAttachment !== false,
      allowTextDescription: chRaw.allowTextDescription !== false,
      allowCodeSubmission: round && round.typeKey === 'coding' ? (chRaw.allowCodeSubmission !== false) : Boolean(chRaw.allowCodeSubmission)
    };

    const paperTitle = String(c.paperTitle || '').trim();
    const description = String(c.description || '').trim();
    const instructions = String(c.instructions || '').trim();
    const hasItems = pdfs.length > 0
      || questions.length > 0
      || codingProblems.length > 0
      || materials.length > 0
      || attachments.length > 0
      || Boolean(paperTitle || description || instructions || challengeSpec.taskDescription);

    const avRaw = c.availability && typeof c.availability === 'object' ? c.availability : {};
    const validModes = CONTENT_AVAILABILITY_MODES.map((m) => m.key);
    const avMode = validModes.includes(avRaw.mode) ? avRaw.mode : 'locked';

    return {
      roundId: String(round.id),
      eventId: String(eventSlug || ''),
      contentStatus: inferDefaultContentStatus(c, hasItems),
      paperTitle,
      description,
      instructions,
      totalMarks: c.totalMarks !== '' && c.totalMarks != null && Number.isFinite(Number(c.totalMarks))
        ? Math.max(0, Number(c.totalMarks))
        : (round && round.scoring && round.scoring.enabled ? Number(round.scoring.maxScore) || 100 : 100),
      durationLabel: String(c.durationLabel || (round ? round.duration : '') || '').trim(),
      declaredQuestionCount: c.declaredQuestionCount !== '' && c.declaredQuestionCount != null && Number(c.declaredQuestionCount) >= 0
        ? Math.round(Number(c.declaredQuestionCount))
        : null,
      availability: {
        mode: avMode,
        releaseAt: String(avRaw.releaseAt || '').trim(),
        requireApprovedRegistration: avRaw.requireApprovedRegistration !== false,
        pausedAccessPolicy: avRaw.pausedAccessPolicy === 'allow' ? 'allow' : 'restrict',
        completedAccessPolicy: avRaw.completedAccessPolicy === 'restrict' ? 'restrict' : 'allow',
        allowPdfDownload: avRaw.allowPdfDownload !== false,
        allowAttachmentDownload: avRaw.allowAttachmentDownload !== false,
        hideAnswerKeysFromParticipants: avRaw.hideAnswerKeysFromParticipants !== false,
        shuffleQuestionsForDisplay: Boolean(avRaw.shuffleQuestionsForDisplay)
      },
      pdfs,
      attachments,
      challengeSpec,
      questions,
      codingProblems,
      materials,
      updatedAt: String(c.updatedAt || '')
    };
  }

  function normalizeEventRoundContent(rawMap, ev) {
    const raw = rawMap && typeof rawMap === 'object' ? rawMap : {};
    const rounds = Array.isArray(ev && ev.rounds) ? ev.rounds : [];
    const eventSlug = String((ev && ev.slug) || '');
    const out = {};
    rounds.forEach((r) => {
      if (!r || !r.id || out[r.id]) return;
      out[r.id] = normalizeRoundContentPackage(raw[r.id], r, eventSlug);
    });
    return out;
  }

  function normalizeRubricCriterion(rawCrit, idx) {
    const c = rawCrit && typeof rawCrit === 'object' ? rawCrit : {};
    return {
      id: String(c.id || createContentItemId('crit')),
      order: idx + 1,
      title: String(c.title || `Criterion ${idx + 1}`).trim(),
      description: String(c.description || '').trim(),
      maxMarks: Math.max(1, Number(c.maxMarks) || 20)
    };
  }

  function computeRubricMax(rubric, roundFallbackMax) {
    if (rubric && Array.isArray(rubric.criteria) && rubric.criteria.length > 0) {
      return rubric.criteria.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);
    }
    const raw = rubric && Number(rubric.maxScore);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return Math.max(1, Number(roundFallbackMax) || 100);
  }

  function buildTargetKey(kind, id) {
    const cleanKind = kind === 'team' ? 'team' : 'participant';
    return `${cleanKind}:${String(id || '').trim()}`;
  }

  function normalizeRoundSubmission(rawSub, targetKey) {
    const s = rawSub && typeof rawSub === 'object' ? rawSub : {};
    const parts = String(targetKey || '').split(':');
    const kind = parts[0] === 'team' ? 'team' : 'participant';
    const tid = parts.slice(1).join(':');
    const hist = Array.isArray(s.submissionHistory)
      ? s.submissionHistory.map((h) => ({
          id: String((h && h.id) || createContentItemId('subh')),
          submittedAt: String((h && h.submittedAt) || ''),
          note: String((h && h.note) || '').trim(),
          selectedLanguage: String((h && h.selectedLanguage) || '').trim()
        }))
      : [];
    return {
      targetKey: String(targetKey),
      targetKind: s.targetKind === 'team' ? 'team' : kind,
      targetId: String(s.targetId || tid),
      submissionType: String(s.submissionType || 'manual').trim(),
      submittedAt: String(s.submittedAt || new Date().toISOString()),
      selectedLanguage: String(s.selectedLanguage || '').trim(),
      submittedCode: String(s.submittedCode || ''),
      problemId: String(s.problemId || '').trim(),
      repoUrl: String(s.repoUrl || '').trim(),
      liveUrl: String(s.liveUrl || '').trim(),
      attachedFiles: Array.isArray(s.attachedFiles) ? s.attachedFiles.map((f) => String(f || '').trim()).filter(Boolean) : [],
      description: String(s.description || '').trim(),
      mcqAnswers: s.mcqAnswers && typeof s.mcqAnswers === 'object' ? { ...s.mcqAnswers } : {},
      submissionHistory: hist,
      updatedAt: String(s.updatedAt || s.submittedAt || new Date().toISOString())
    };
  }

  function normalizeEvaluationRecord(rawRec, targetKey, fallbackMax) {
    const r = rawRec && typeof rawRec === 'object' ? rawRec : {};
    const parts = String(targetKey || '').split(':');
    const kind = parts[0] === 'team' ? 'team' : 'participant';
    const tid = parts.slice(1).join(':');
    const maxMarks = Math.max(1, Number.isFinite(Number(r.maxMarks)) && Number(r.maxMarks) > 0 ? Number(r.maxMarks) : (Number(fallbackMax) || 100));
    const awardedRaw = Number.isFinite(Number(r.awardedMarks)) ? Number(r.awardedMarks) : 0;
    const criteriaMarks = r.criteriaMarks && typeof r.criteriaMarks === 'object' ? { ...r.criteriaMarks } : {};
    const status = EVALUATION_STATUSES.includes(r.evaluationStatus) ? r.evaluationStatus : 'Not Evaluated';
    const percentage = maxMarks > 0 ? Math.round((awardedRaw / maxMarks) * 10000) / 100 : 0;
    return {
      targetKey: String(targetKey),
      targetKind: r.targetKind === 'team' ? 'team' : kind,
      targetId: String(r.targetId || tid),
      awardedMarks: Math.round(awardedRaw * 100) / 100,
      maxMarks: Math.round(maxMarks * 100) / 100,
      percentage,
      criteriaMarks,
      evaluationStatus: status,
      evaluationNotes: String(r.evaluationNotes || '').trim(),
      publicFeedback: String(r.publicFeedback || '').trim(),
      evaluatorId: String(r.evaluatorId || '').trim(),
      evaluatorName: String(r.evaluatorName || '').trim(),
      evaluatedAt: String(r.evaluatedAt || ''),
      updatedAt: String(r.updatedAt || ''),
      reopenedAt: String(r.reopenedAt || ''),
      mcqBreakdown: r.mcqBreakdown && typeof r.mcqBreakdown === 'object' ? { ...r.mcqBreakdown } : null
    };
  }

  function normalizeRoundEvalPackage(rawPkg, round, validTargetKeys) {
    const p = rawPkg && typeof rawPkg === 'object' ? rawPkg : {};
    const rubRaw = p.rubric && typeof p.rubric === 'object' ? p.rubric : {};
    const criteria = Array.isArray(rubRaw.criteria)
      ? rubRaw.criteria.map((c, idx) => normalizeRubricCriterion(c, idx)).filter((c) => Boolean(c.title))
      : [];
    const roundFallbackMax = round && round.scoring && Number(round.scoring.maxScore) > 0 ? Number(round.scoring.maxScore) : 100;
    const defaultMode = (round && (round.typeKey === 'quiz' || round.typeKey === 'mcq'))
      ? 'auto_mcq'
      : (criteria.length > 0 ? 'rubric' : 'manual');
    const rubMode = ['manual', 'rubric', 'auto_mcq'].includes(rubRaw.mode) ? rubRaw.mode : defaultMode;
    const multiRule = MULTI_ANSWER_SCORING_RULES.some((m) => m.key === rubRaw.multiAnswerRule)
      ? rubRaw.multiAnswerRule
      : 'exact_match';
    const rubric = {
      mode: rubMode,
      maxScore: criteria.length > 0
        ? criteria.reduce((sum, c) => sum + c.maxMarks, 0)
        : (Number.isFinite(Number(rubRaw.maxScore)) && Number(rubRaw.maxScore) > 0 ? Number(rubRaw.maxScore) : roundFallbackMax),
      multiAnswerRule: multiRule,
      applyNegativeMarking: Boolean(rubRaw.applyNegativeMarking),
      criteria
    };

    const subsRaw = p.submissionsByTarget && typeof p.submissionsByTarget === 'object' ? p.submissionsByTarget : {};
    const submissionsByTarget = {};
    Object.keys(subsRaw).forEach((tk) => {
      if (validTargetKeys.has(tk) && subsRaw[tk]) {
        submissionsByTarget[tk] = normalizeRoundSubmission(subsRaw[tk], tk);
      }
    });

    const scoresRaw = p.scoresByTarget && typeof p.scoresByTarget === 'object' ? p.scoresByTarget : {};
    const scoresByTarget = {};
    Object.keys(scoresRaw).forEach((tk) => {
      if (validTargetKeys.has(tk) && scoresRaw[tk]) {
        scoresByTarget[tk] = normalizeEvaluationRecord(scoresRaw[tk], tk, rubric.maxScore);
      }
    });

    const qRaw = p.qualification && typeof p.qualification === 'object' ? p.qualification : {};
    const strat = QUALIFICATION_STRATEGIES.some((s) => s.key === qRaw.strategy) ? qRaw.strategy : 'top_n';
    const qualification = {
      strategy: strat,
      topN: Math.max(1, Math.round(Number(qRaw.topN) || 10)),
      minScore: Math.max(0, Number.isFinite(Number(qRaw.minScore)) ? Number(qRaw.minScore) : 40),
      minPercentage: Math.max(0, Math.min(100, Number.isFinite(Number(qRaw.minPercentage)) ? Number(qRaw.minPercentage) : 60)),
      allowPendingEvaluation: Boolean(qRaw.allowPendingEvaluation),
      manualSelectedKeys: Array.isArray(qRaw.manualSelectedKeys) ? qRaw.manualSelectedKeys.filter((k) => validTargetKeys.has(k)) : [],
      finalized: Boolean(qRaw.finalized),
      finalizedAt: String(qRaw.finalizedAt || ''),
      targetNextRoundId: String(qRaw.targetNextRoundId || ''),
      qualifiedKeys: Array.isArray(qRaw.qualifiedKeys) ? qRaw.qualifiedKeys.filter((k) => validTargetKeys.has(k)) : [],
      progressedKeys: Array.isArray(qRaw.progressedKeys) ? qRaw.progressedKeys.filter((k) => validTargetKeys.has(k)) : [],
      progressedAt: String(qRaw.progressedAt || ''),
      history: Array.isArray(qRaw.history) ? qRaw.history.slice(0, 40).map((h) => ({ ...h })) : []
    };

    const tRaw = p.tieBreaker && typeof p.tieBreaker === 'object' ? p.tieBreaker : {};
    const primaryRule = TIE_BREAKER_MODES.some((m) => m.key === tRaw.primaryRule) ? tRaw.primaryRule : 'earlier_submission';
    const tieBreaker = {
      primaryRule,
      criterionId: String(tRaw.criterionId || ''),
      refRoundId: String(tRaw.refRoundId || ''),
      manualRankOrderOverrides: tRaw.manualRankOrderOverrides && typeof tRaw.manualRankOrderOverrides === 'object'
        ? { ...tRaw.manualRankOrderOverrides }
        : {}
    };

    const pubRaw = p.publication && typeof p.publication === 'object' ? p.publication : {};
    const publication = {
      roundPublished: Boolean(pubRaw.roundPublished),
      leaderboardPublished: Boolean(pubRaw.leaderboardPublished),
      showPublicFeedback: Boolean(pubRaw.showPublicFeedback),
      publishedAt: String(pubRaw.publishedAt || ''),
      updatedAt: String(pubRaw.updatedAt || '')
    };

    return {
      roundId: String(round.id),
      rubric,
      submissionsByTarget,
      scoresByTarget,
      qualification,
      tieBreaker,
      publication
    };
  }

  function normalizeEvaluationState(rawEvalState, ev) {
    const raw = rawEvalState && typeof rawEvalState === 'object' ? rawEvalState : {};
    const rounds = Array.isArray(ev && ev.rounds) ? ev.rounds : [];
    const participants = Array.isArray(ev && ev.participants) ? ev.participants : [];
    const teams = Array.isArray(ev && ev.teams) ? ev.teams : [];

    const validTargetKeys = new Set();
    participants.forEach((p) => { if (p && p.id) validTargetKeys.add(buildTargetKey('participant', p.id)); });
    teams.forEach((t) => { if (t && t.id) validTargetKeys.add(buildTargetKey('team', t.id)); });

    const roundMapRaw = raw.roundEvalsById && typeof raw.roundEvalsById === 'object' ? raw.roundEvalsById : {};
    const roundEvalsById = {};
    rounds.forEach((r) => {
      if (!r || !r.id || roundEvalsById[r.id]) return;
      roundEvalsById[r.id] = normalizeRoundEvalPackage(roundMapRaw[r.id], r, validTargetKeys);
    });

    const ovRaw = raw.overallConfig && typeof raw.overallConfig === 'object' ? raw.overallConfig : {};
    const activeRoundIds = rounds.filter((r) => r.enabled !== false).map((r) => r.id);
    const ovMode = OVERALL_SCORING_MODES.some((m) => m.key === ovRaw.mode) ? ovRaw.mode : 'weighted_percentage';
    const includedRoundIds = Array.isArray(ovRaw.includedRoundIds) && ovRaw.includedRoundIds.length
      ? ovRaw.includedRoundIds.filter((id) => rounds.some((r) => r.id === id))
      : activeRoundIds;

    const weightsRaw = ovRaw.weightsByRoundId && typeof ovRaw.weightsByRoundId === 'object' ? ovRaw.weightsByRoundId : {};
    const weightsByRoundId = {};
    if (Object.keys(weightsRaw).length > 0) {
      includedRoundIds.forEach((id) => {
        const w = Number(weightsRaw[id]);
        weightsByRoundId[id] = Number.isFinite(w) && w >= 0 ? w : 0;
      });
    } else if (includedRoundIds.length > 0) {
      const equalW = Math.floor((100 / includedRoundIds.length) * 100) / 100;
      let rem = 100;
      includedRoundIds.forEach((id, idx) => {
        if (idx === includedRoundIds.length - 1) {
          weightsByRoundId[id] = Math.round(rem * 100) / 100;
        } else {
          weightsByRoundId[id] = equalW;
          rem -= equalW;
        }
      });
    }

    const manualFinalOverrides = {};
    if (ovRaw.manualFinalOverrides && typeof ovRaw.manualFinalOverrides === 'object') {
      Object.keys(ovRaw.manualFinalOverrides).forEach((tk) => {
        if (validTargetKeys.has(tk) && Number.isFinite(Number(ovRaw.manualFinalOverrides[tk]))) {
          manualFinalOverrides[tk] = Number(ovRaw.manualFinalOverrides[tk]);
        }
      });
    }

    return {
      roundEvalsById,
      overallConfig: {
        mode: ovMode,
        includedRoundIds,
        weightsByRoundId,
        manualFinalOverrides,
        tieBreakerRule: TIE_BREAKER_MODES.some((m) => m.key === ovRaw.tieBreakerRule) ? ovRaw.tieBreakerRule : 'earlier_submission',
        manualRankOrderOverrides: ovRaw.manualRankOrderOverrides && typeof ovRaw.manualRankOrderOverrides === 'object'
          ? { ...ovRaw.manualRankOrderOverrides }
          : {},
        showPublicFeedback: Boolean(ovRaw.showPublicFeedback),
        published: Boolean(ovRaw.published),
        publishedAt: String(ovRaw.publishedAt || '')
      }
    };
  }

  let _backendMode = 'local_prototype'; // 'local_prototype' | 'supabase'
  const _remoteEventsBySlug = new Map();
  let _remoteOrder = [];
  let _syncListener = null;
  let _skipSyncNotify = false;

  function setBackendMode(mode) {
    _backendMode = mode === 'supabase' ? 'supabase' : 'local_prototype';
  }

  function getBackendMode() {
    return _backendMode;
  }

  function setSyncListener(fn) {
    _syncListener = typeof fn === 'function' ? fn : null;
  }

  function notifyRemoteSync(op, eventObj, prevEventObj) {
    if (_backendMode !== 'supabase' || _skipSyncNotify || !_syncListener) return;
    try {
      _syncListener(op, eventObj, prevEventObj);
    } catch (_) {}
  }

  function replaceRemoteCatalog(eventsList) {
    _skipSyncNotify = true;
    try {
      _remoteEventsBySlug.clear();
      _remoteOrder = [];
      (Array.isArray(eventsList) ? eventsList : []).forEach((raw) => {
        if (!raw || !raw.slug) return;
        const norm = normalizeEvent({ ...raw, _source: 'supabase' });
        _remoteEventsBySlug.set(norm.slug, norm);
        _remoteOrder.push(norm.slug);
      });
    } finally {
      _skipSyncNotify = false;
    }
  }

  function upsertRemoteEvent(rawEv) {
    if (!rawEv || !rawEv.slug) return null;
    _skipSyncNotify = true;
    try {
      const prev = _remoteEventsBySlug.get(rawEv.slug) || {};
      const norm = normalizeEvent({ ...prev, ...rawEv, _source: 'supabase' });
      _remoteEventsBySlug.set(norm.slug, norm);
      if (!_remoteOrder.includes(norm.slug)) _remoteOrder.unshift(norm.slug);
      return norm;
    } finally {
      _skipSyncNotify = false;
    }
  }

  function removeRemoteEvent(slug) {
    _remoteEventsBySlug.delete(slug);
    _remoteOrder = _remoteOrder.filter((s) => s !== slug);
  }

  function getPreviewEvents() {
    const parsed = safeJsonRead(PREVIEW_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function getOverrides() {
    const parsed = safeJsonRead(OVERRIDES_STORAGE_KEY, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function getLocalPrototypeSnapshot() {
    const deletedSet = new Set(getDeletedSlugs());
    const overrides = getOverrides();
    const previews = getPreviewEvents();
    const localItems = [];
    previews.forEach((raw) => {
      if (!raw || !raw.slug || deletedSet.has(raw.slug)) return;
      const patched = overrides[raw.slug] ? { ...raw, ...overrides[raw.slug] } : raw;
      localItems.push(normalizeEvent(patched));
    });
    Object.keys(overrides).forEach((slug) => {
      if (deletedSet.has(slug) || localItems.some((e) => e.slug === slug)) return;
      const baseSample = SAMPLE_EVENTS.find((s) => s.slug === slug);
      if (baseSample) {
        localItems.push(normalizeEvent({ ...baseSample, ...overrides[slug] }));
      }
    });
    return {
      createdCount: previews.length,
      overrideCount: Object.keys(overrides).length,
      events: localItems
    };
  }

  function getDeletedSlugs() {
    const parsed = safeJsonRead(DELETED_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function getRecentActivity() {
    const parsed = safeJsonRead(ACTIVITY_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function logActivity(type, title, detail, slug) {
    const items = getRecentActivity();
    items.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: type || 'update',
      title: String(title || 'Workspace Action'),
      detail: String(detail || ''),
      slug: slug || '',
      timestamp: new Date().toISOString()
    });
    safeJsonWrite(ACTIVITY_STORAGE_KEY, items.slice(0, 25));
  }

  function savePreviewEvent(ev) {
    const normalized = normalizeEvent({
      ...ev,
      isPreviewDraft: true,
      isCreatedEvent: true,
      createdAt: ev.createdAt || new Date().toISOString()
    });
    if (_backendMode === 'supabase') {
      _remoteEventsBySlug.set(normalized.slug, normalized);
      if (!_remoteOrder.includes(normalized.slug)) _remoteOrder.unshift(normalized.slug);
      logActivity('create', `Created event "${normalized.name}"`, `${normalized.categoryLabel} • ${normalized.rounds.length} round(s)`, normalized.slug);
      notifyRemoteSync('create', normalized, null);
      return { stored: true, omittedImage: false, event: normalized };
    }
    const existing = getPreviewEvents().filter((item) => item && item.slug !== normalized.slug);
    existing.unshift(normalized);

    const deleted = getDeletedSlugs().filter((s) => s !== normalized.slug);
    safeJsonWrite(DELETED_STORAGE_KEY, deleted);

    const storedFull = safeJsonWrite(PREVIEW_STORAGE_KEY, existing);
    if (storedFull) {
      logActivity('create', `Created event "${normalized.name}"`, `${normalized.categoryLabel} • ${normalized.rounds.length} round(s)`, normalized.slug);
      return { stored: true, omittedImage: false, event: normalized };
    }
    // If a high-resolution data URL exceeds sessionStorage quota, persist metadata with empty coverImage fallback.
    const compactEvent = Object.assign({}, normalized, { coverImage: '' });
    const compactList = [compactEvent, ...existing.slice(1).map((item) => Object.assign({}, item, { coverImage: '' }))];
    const storedCompact = safeJsonWrite(PREVIEW_STORAGE_KEY, compactList);
    logActivity('create', `Created event "${normalized.name}"`, 'Saved metadata locally (large poster omitted due to browser quota)', normalized.slug);
    return { stored: storedCompact, omittedImage: true, event: compactEvent };
  }

  function getAllEvents() {
    if (_backendMode === 'supabase') {
      return _remoteOrder.map((s) => _remoteEventsBySlug.get(s)).filter(Boolean);
    }
    const deletedSet = new Set(getDeletedSlugs());
    const overrides = getOverrides();
    const previews = getPreviewEvents();
    const seen = new Set();
    const combined = [];

    [...previews, ...SAMPLE_EVENTS].forEach((raw) => {
      if (!raw || !raw.slug || deletedSet.has(raw.slug) || seen.has(raw.slug)) return;
      seen.add(raw.slug);
      const patched = overrides[raw.slug] ? { ...raw, ...overrides[raw.slug] } : raw;
      combined.push(normalizeEvent(patched));
    });
    return combined;
  }

  function getOrganizerEvents(organizerEmail) {
    if (_backendMode === 'supabase') {
      return getAllEvents();
    }
    const email = String(organizerEmail || '').trim().toLowerCase();
    return getAllEvents().filter((ev) => {
      if (ev.ownerEmail && email && ev.ownerEmail.toLowerCase() !== email) {
        return false;
      }
      return true;
    });
  }

  function getFeaturedEvents() {
    return getAllEvents().filter((e) => e.featured && e.statusKey !== 'cancelled' && e.visibility !== 'private').slice(0, 3);
  }

  function getEventBySlug(slug) {
    if (!slug) return null;
    if (_backendMode === 'supabase') {
      return _remoteEventsBySlug.get(slug) || null;
    }
    return getAllEvents().find((e) => e.slug === slug) || null;
  }

  function updateEvent(slug, patch) {
    const current = getEventBySlug(slug);
    if (!current || !patch || typeof patch !== 'object') return { ok: false, omittedImage: false, event: null };

    const nextPatch = { ...patch };
    delete nextPatch._skipLog;
    if (nextPatch.statusKey && STATUS_META[nextPatch.statusKey] && !nextPatch.eventStatus) {
      nextPatch.eventStatus = STATUS_META[nextPatch.statusKey].label;
    } else if (nextPatch.eventStatus && !nextPatch.statusKey) {
      nextPatch.statusKey = deriveStatusKey({ eventStatus: nextPatch.eventStatus });
    }
    if (nextPatch.category && !nextPatch.categoryLabel) {
      const catObj = CATEGORIES.find((c) => c.slug === nextPatch.category);
      if (catObj) nextPatch.categoryLabel = catObj.name;
    }

    if (Array.isArray(nextPatch.rounds)) {
      nextPatch.rounds = deepCloneRounds(nextPatch.rounds, false);
    }

    const updated = normalizeEvent({ ...current, ...nextPatch, updatedAt: new Date().toISOString() });
    if (_backendMode === 'supabase') {
      _remoteEventsBySlug.set(slug, updated);
      if (!patch._skipLog) {
        logActivity('edit', `Updated "${updated.name}"`, `Status: ${updated.eventStatus}`, slug);
      }
      notifyRemoteSync('update', updated, current);
      return { ok: true, omittedImage: false, event: updated };
    }
    const previews = getPreviewEvents();
    const previewIdx = previews.findIndex((p) => p && p.slug === slug);

    let saved = false;
    let omittedImage = false;
    if (previewIdx >= 0) {
      previews[previewIdx] = updated;
      saved = safeJsonWrite(PREVIEW_STORAGE_KEY, previews);
      if (!saved) {
        previews[previewIdx] = { ...updated, coverImage: '' };
        saved = safeJsonWrite(PREVIEW_STORAGE_KEY, previews);
        omittedImage = true;
      }
    } else {
      const overrides = getOverrides();
      overrides[slug] = { ...(overrides[slug] || {}), ...nextPatch, updatedAt: new Date().toISOString() };
      saved = safeJsonWrite(OVERRIDES_STORAGE_KEY, overrides);
      if (!saved && nextPatch.coverImage) {
        overrides[slug] = { ...(overrides[slug] || {}), ...nextPatch, coverImage: '', updatedAt: new Date().toISOString() };
        saved = safeJsonWrite(OVERRIDES_STORAGE_KEY, overrides);
        omittedImage = true;
      }
    }

    if (!patch._skipLog) {
      logActivity('edit', `Updated "${updated.name}"`, `Status: ${updated.eventStatus}`, slug);
    }
    return { ok: saved, omittedImage, event: omittedImage ? normalizeEvent({ ...updated, coverImage: '' }) : updated };
  }

  function saveEventRounds(slug, rounds) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const safeRounds = deepCloneRounds(Array.isArray(rounds) ? rounds : [], false);
    const stamped = new Date().toISOString();
    const res = updateEvent(slug, {
      rounds: safeRounds,
      roundConfigUpdatedAt: stamped,
      _skipLog: true
    });
    if (res.ok && res.event) {
      logActivity(
        'edit',
        `Saved Round Builder for "${res.event.name}"`,
        `${safeRounds.length} round(s) configured`,
        slug
      );
    }
    return {
      ok: Boolean(res.ok),
      event: res.event,
      error: res.ok ? '' : 'Unable to save round configuration in browser sessionStorage.'
    };
  }

  function getParticipantStats(participants) {
    const list = Array.isArray(participants) ? participants : [];
    let approved = 0;
    let pending = 0;
    let waitlisted = 0;
    let rejected = 0;
    let cancelled = 0;
    let assigned = 0;
    let unassigned = 0;
    list.forEach((p) => {
      if (p.registrationStatus === 'Approved') approved += 1;
      else if (p.registrationStatus === 'Waitlisted') waitlisted += 1;
      else if (p.registrationStatus === 'Rejected') rejected += 1;
      else if (p.registrationStatus === 'Cancelled') cancelled += 1;
      else pending += 1;
      if (p.teamId) assigned += 1;
      else unassigned += 1;
    });
    return {
      total: list.length,
      approved,
      pending,
      waitlisted,
      rejected,
      cancelled,
      activeSlots: approved + pending,
      assigned,
      unassigned
    };
  }

  function getTeamStats(teams, teamConfig) {
    const list = Array.isArray(teams) ? teams : [];
    const minSize = teamConfig && teamConfig.minSize ? teamConfig.minSize : 1;
    let active = 0;
    let openSlots = 0;
    let full = 0;
    let awaiting = 0;
    let locked = 0;
    list.forEach((t) => {
      const count = Array.isArray(t.memberIds) ? t.memberIds.length : 0;
      if (t.status === 'Locked') locked += 1;
      else if (count >= t.maxTeamSize) full += 1;
      else {
        openSlots += 1;
        if (count < minSize || t.status === 'Awaiting Members') awaiting += 1;
        else active += 1;
      }
    });
    return {
      total: list.length,
      active,
      openSlots,
      full,
      awaiting,
      locked
    };
  }

  function saveEventRosterState(slug, rawParticipants, rawTeams, activityTitle, activityDetail) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const reconciled = reconcileEventRoster(rawParticipants, rawTeams, slug, current.teamConfig);
    const nonCancelledCount = reconciled.participants.filter((p) => p.registrationStatus !== 'Cancelled').length;
    const stamped = new Date().toISOString();
    const res = updateEvent(slug, {
      participants: reconciled.participants,
      teams: reconciled.teams,
      registrationCount: nonCancelledCount,
      rosterUpdatedAt: stamped,
      _skipLog: true
    });
    if (res.ok && res.event && activityTitle) {
      logActivity('edit', activityTitle, activityDetail || '', slug);
    }
    return {
      ok: Boolean(res.ok),
      event: res.event,
      error: res.ok ? '' : 'Unable to save participants & teams to browser sessionStorage.'
    };
  }

  function saveTeamRules(slug, rulesPatch) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const r = rulesPatch && typeof rulesPatch === 'object' ? rulesPatch : {};
    const supported = typeof r.supported === 'boolean' ? r.supported : current.teamConfig.supported;
    const minSize = Number(r.minSize != null ? r.minSize : current.teamConfig.minSize);
    const maxSize = Number(r.maxSize != null ? r.maxSize : current.teamConfig.maxSize);

    if (supported) {
      if (!Number.isFinite(minSize) || minSize < 1 || minSize > 20) {
        return { ok: false, event: current, error: 'Minimum team size must be between 1 and 20.' };
      }
      if (!Number.isFinite(maxSize) || maxSize < minSize || maxSize > 20) {
        return { ok: false, event: current, error: 'Maximum team size must be >= minimum team size and <= 20.' };
      }
    }

    const nextConfig = normalizeTeamConfig({
      ...current.teamConfig,
      ...r,
      supported,
      minSize: supported ? Math.floor(minSize) : 1,
      maxSize: supported ? Math.floor(maxSize) : 1
    }, supported ? 'team' : 'individual');

    const reconciled = reconcileEventRoster(current.participants, current.teams, slug, nextConfig);
    const res = updateEvent(slug, {
      participationType: nextConfig.supported ? 'team' : 'individual',
      teamConfig: nextConfig,
      participants: reconciled.participants,
      teams: reconciled.teams,
      registrationCount: reconciled.participants.length,
      rosterUpdatedAt: new Date().toISOString(),
      _skipLog: true
    });
    if (res.ok && res.event) {
      logActivity('edit', `Updated team rules for "${res.event.name}"`, nextConfig.label, slug);
    }
    return { ok: Boolean(res.ok), event: res.event, error: res.ok ? '' : 'Failed to save team rules.' };
  }

  function updateParticipantStatus(slug, participantId, nextStatus) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (!REGISTRATION_STATUSES.includes(nextStatus)) {
      return { ok: false, event: current, error: 'Invalid registration status.' };
    }
    const target = current.participants.find((p) => p.id === participantId);
    if (!target) {
      return { ok: false, event: current, error: 'Participant does not belong to this event.' };
    }
    const nowIso = new Date().toISOString();
    const nextParticipants = current.participants.map((p) => (
      p.id === participantId
        ? {
            ...p,
            registrationStatus: nextStatus,
            updatedAt: nowIso,
            cancellation: nextStatus === 'Cancelled'
              ? { cancelledAt: nowIso, reason: 'Marked Cancelled by organizer' }
              : (p.registrationStatus === 'Cancelled' ? null : p.cancellation)
          }
        : p
    ));
    let nextTeams = current.teams;
    if (nextStatus === 'Cancelled' || nextStatus === 'Rejected') {
      nextTeams = current.teams.map((t) => ({
        ...t,
        memberIds: (t.memberIds || []).filter((mid) => mid !== participantId),
        teamLeaderId: t.teamLeaderId === participantId ? null : t.teamLeaderId
      }));
    }
    return saveEventRosterState(
      slug,
      nextParticipants,
      nextTeams,
      `Updated registration status for ${target.fullName}`,
      `${target.registrationId} -> ${nextStatus}`
    );
  }

  function findExclusiveConflicts(teams, memberIds, excludeTeamId, participantsMap) {
    const conflicts = [];
    teams.forEach((t) => {
      if (excludeTeamId && t.id === excludeTeamId) return;
      (t.memberIds || []).forEach((mid) => {
        if (memberIds.includes(mid)) {
          const p = participantsMap.get(mid);
          conflicts.push(`${p ? p.fullName : mid} (already in "${t.teamName}")`);
        }
      });
    });
    return conflicts;
  }

  function createTeam(slug, payload) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (!current.teamConfig.supported) {
      return { ok: false, event: current, error: 'This event uses Individual Participation mode. Enable Team Registration rules first.' };
    }
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is currently locked by event rules.' };
    }

    const p = payload && typeof payload === 'object' ? payload : {};
    const teamName = String(p.teamName || '').trim();
    if (!teamName || teamName.length < 2) {
      return { ok: false, event: current, error: 'Enter a team name (at least 2 characters).' };
    }
    const duplicateName = current.teams.some((t) => t.teamName.toLowerCase() === teamName.toLowerCase());
    if (duplicateName) {
      return { ok: false, event: current, error: `A team named "${teamName}" already exists in this event.` };
    }

    const eventMaxCap = current.teamConfig.maxSize || 4;
    const maxCap = Number(p.maxTeamSize != null && p.maxTeamSize !== '' ? p.maxTeamSize : eventMaxCap);
    if (!Number.isFinite(maxCap) || maxCap < 1 || maxCap > eventMaxCap) {
      return { ok: false, event: current, error: `Team capacity must be between 1 and ${eventMaxCap} (the event maximum).` };
    }

    const pMap = new Map(current.participants.map((item) => [item.id, item]));
    const rawMembers = Array.isArray(p.memberIds) ? p.memberIds.map((id) => String(id).trim()).filter(Boolean) : [];
    let leaderId = p.teamLeaderId ? String(p.teamLeaderId).trim() : null;
    if (leaderId && !rawMembers.includes(leaderId)) {
      rawMembers.unshift(leaderId);
    }

    const seen = new Set();
    const memberIds = [];
    for (let i = 0; i < rawMembers.length; i++) {
      const mid = rawMembers[i];
      if (!pMap.has(mid)) {
        return { ok: false, event: current, error: 'Selected member is not registered for this event.' };
      }
      if (seen.has(mid)) {
        return { ok: false, event: current, error: 'Duplicate participant cannot be added twice to the same team.' };
      }
      seen.add(mid);
      memberIds.push(mid);
    }

    if (memberIds.length > maxCap) {
      return { ok: false, event: current, error: `Selected members (${memberIds.length}) exceed team capacity (${maxCap}).` };
    }

    if (current.teamConfig.requireLeader) {
      if (!leaderId || !memberIds.includes(leaderId)) {
        return { ok: false, event: current, error: 'Select a Team Leader who is a member of this team.' };
      }
    } else if (leaderId && !memberIds.includes(leaderId)) {
      return { ok: false, event: current, error: 'Selected Team Leader must belong to the team.' };
    }

    if (current.teamConfig.exclusiveMembership) {
      const conflicts = findExclusiveConflicts(current.teams, memberIds, null, pMap);
      if (conflicts.length > 0) {
        return { ok: false, event: current, error: `Exclusive team rule active: ${conflicts[0]}.` };
      }
    }

    const newTeam = normalizeTeam({
      id: createTeamId(),
      eventId: slug,
      teamName,
      description: String(p.description || '').trim(),
      teamLeaderId: leaderId,
      memberIds,
      maxTeamSize: Math.floor(maxCap),
      createdAt: new Date().toISOString(),
      isDemo: memberIds.some((id) => pMap.get(id)?.isDemo)
    }, slug, current.teams.length, eventMaxCap);

    const res = saveEventRosterState(
      slug,
      current.participants,
      [newTeam, ...current.teams],
      `Created team "${newTeam.teamName}"`,
      `${memberIds.length} member(s) in "${current.name}"`
    );
    return { ...res, team: res.event ? res.event.teams.find((t) => t.id === newTeam.id) : null };
  }

  function updateTeam(slug, teamId, payload) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (!current.teamConfig.supported) {
      return { ok: false, event: current, error: 'Team formation is disabled for individual events.' };
    }
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is locked by event rules.' };
    }

    const existing = current.teams.find((t) => t.id === teamId);
    if (!existing) return { ok: false, event: current, error: 'Team not found in this event.' };

    const p = payload && typeof payload === 'object' ? payload : {};
    const teamName = p.teamName != null ? String(p.teamName).trim() : existing.teamName;
    if (!teamName || teamName.length < 2) {
      return { ok: false, event: current, error: 'Enter a valid team name (at least 2 characters).' };
    }
    const dupName = current.teams.some((t) => t.id !== teamId && t.teamName.toLowerCase() === teamName.toLowerCase());
    if (dupName) {
      return { ok: false, event: current, error: `Another team in this event already uses "${teamName}".` };
    }

    const eventMaxCap = current.teamConfig.maxSize || 4;
    const maxCap = Number(p.maxTeamSize != null && p.maxTeamSize !== '' ? p.maxTeamSize : existing.maxTeamSize);
    if (!Number.isFinite(maxCap) || maxCap < 1 || maxCap > eventMaxCap) {
      return { ok: false, event: current, error: `Team capacity must be between 1 and ${eventMaxCap}.` };
    }

    const pMap = new Map(current.participants.map((item) => [item.id, item]));
    const rawMembers = Array.isArray(p.memberIds) ? p.memberIds.map((id) => String(id).trim()).filter(Boolean) : [...existing.memberIds];
    let leaderId = p.teamLeaderId !== undefined ? (p.teamLeaderId ? String(p.teamLeaderId).trim() : null) : existing.teamLeaderId;
    if (leaderId && !rawMembers.includes(leaderId)) {
      return { ok: false, event: current, error: 'Team Leader must be a member of the team.' };
    }

    const seen = new Set();
    const memberIds = [];
    for (let i = 0; i < rawMembers.length; i++) {
      const mid = rawMembers[i];
      if (!pMap.has(mid)) return { ok: false, event: current, error: 'Cannot add a participant not registered for this event.' };
      if (seen.has(mid)) return { ok: false, event: current, error: 'Duplicate member detected in team.' };
      seen.add(mid);
      memberIds.push(mid);
    }

    if (memberIds.length > maxCap) {
      return { ok: false, event: current, error: `Team has ${memberIds.length} members, exceeding capacity (${maxCap}).` };
    }

    if (current.teamConfig.requireLeader && memberIds.length > 0 && (!leaderId || !memberIds.includes(leaderId))) {
      return { ok: false, event: current, error: 'Team Leader is required when team has members.' };
    }

    if (current.teamConfig.exclusiveMembership) {
      const conflicts = findExclusiveConflicts(current.teams, memberIds, teamId, pMap);
      if (conflicts.length > 0) {
        return { ok: false, event: current, error: `Exclusive team rule active: ${conflicts[0]}.` };
      }
    }

    const nextTeams = current.teams.map((t) => (
      t.id === teamId
        ? {
            ...t,
            teamName,
            description: p.description != null ? String(p.description).trim() : t.description,
            teamLeaderId: leaderId,
            memberIds,
            maxTeamSize: Math.floor(maxCap)
          }
        : t
    ));

    return saveEventRosterState(
      slug,
      current.participants,
      nextTeams,
      `Updated team "${teamName}"`,
      `${memberIds.length}/${Math.floor(maxCap)} member(s)`
    );
  }

  function deleteTeam(slug, teamId) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is locked by event rules.' };
    }
    const target = current.teams.find((t) => t.id === teamId);
    if (!target) return { ok: false, event: current, error: 'Team not found.' };

    const nextTeams = current.teams.filter((t) => t.id !== teamId);
    // Keep all participant registrations untouched; reconcileEventRoster clears teamId automatically
    return saveEventRosterState(
      slug,
      current.participants,
      nextTeams,
      `Deleted team "${target.teamName}"`,
      'Registrations preserved cleanly as unassigned'
    );
  }

  function assignMembersToTeam(slug, teamId, participantIdsToAdd) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (!current.teamConfig.supported) {
      return { ok: false, event: current, error: 'Enable Team Registration before assigning participants to teams.' };
    }
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is locked by event rules.' };
    }
    const team = current.teams.find((t) => t.id === teamId);
    if (!team) return { ok: false, event: current, error: 'Target team does not exist in this event.' };

    const ids = Array.isArray(participantIdsToAdd) ? participantIdsToAdd.map((id) => String(id).trim()).filter(Boolean) : [];
    if (!ids.length) return { ok: false, event: current, error: 'Select at least one participant to add.' };

    const pMap = new Map(current.participants.map((p) => [p.id, p]));
    const existingSet = new Set(team.memberIds);
    const additions = [];

    for (let i = 0; i < ids.length; i++) {
      const pid = ids[i];
      if (!pMap.has(pid)) {
        return { ok: false, event: current, error: 'Participant is not registered for this event.' };
      }
      if (existingSet.has(pid)) {
        const pObj = pMap.get(pid);
        return { ok: false, event: current, error: `${pObj ? pObj.fullName : pid} is already a member of "${team.teamName}".` };
      }
      existingSet.add(pid);
      additions.push(pid);
    }

    const nextMembers = [...team.memberIds, ...additions];
    if (nextMembers.length > team.maxTeamSize) {
      return {
        ok: false,
        event: current,
        error: `Cannot add ${additions.length} participant(s): "${team.teamName}" only has ${Math.max(0, team.maxTeamSize - team.memberIds.length)} open slot(s) of ${team.maxTeamSize}.`
      };
    }

    if (current.teamConfig.exclusiveMembership) {
      const conflicts = findExclusiveConflicts(current.teams, additions, teamId, pMap);
      if (conflicts.length > 0) {
        return { ok: false, event: current, error: `Exclusive team rule prevented assignment: ${conflicts[0]}.` };
      }
    }

    const nextLeaderId = team.teamLeaderId || (current.teamConfig.requireLeader ? nextMembers[0] : null);
    return updateTeam(slug, teamId, {
      memberIds: nextMembers,
      teamLeaderId: nextLeaderId
    });
  }

  function removeMemberFromTeam(slug, teamId, participantId, replacementLeaderId) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is locked by event rules.' };
    }
    const team = current.teams.find((t) => t.id === teamId);
    if (!team) return { ok: false, event: current, error: 'Team not found.' };
    if (!team.memberIds.includes(participantId)) {
      return { ok: false, event: current, error: 'Participant is not in this team.' };
    }

    const remaining = team.memberIds.filter((id) => id !== participantId);
    let nextLeaderId = team.teamLeaderId;

    if (participantId === team.teamLeaderId) {
      if (remaining.length === 0) {
        nextLeaderId = null;
      } else if (replacementLeaderId && remaining.includes(replacementLeaderId)) {
        nextLeaderId = replacementLeaderId;
      } else if (current.teamConfig.requireLeader) {
        return {
          ok: false,
          requiresLeaderSelection: true,
          remainingMemberIds: remaining,
          event: current,
          error: 'This participant is the Team Leader. Select a replacement Team Leader from the remaining members.'
        };
      } else {
        nextLeaderId = null;
      }
    }

    const nextTeams = current.teams.map((t) =>
      t.id === teamId ? { ...t, memberIds: remaining, teamLeaderId: nextLeaderId } : t
    );

    const pObj = current.participants.find((p) => p.id === participantId);
    return saveEventRosterState(
      slug,
      current.participants,
      nextTeams,
      `Removed ${pObj ? pObj.fullName : 'member'} from "${team.teamName}"`,
      'Participant registration remains active as unassigned'
    );
  }

  function setTeamLeader(slug, teamId, newLeaderId) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    if (current.teamConfig.locked) {
      return { ok: false, event: current, error: 'Team membership is locked by event rules.' };
    }
    const team = current.teams.find((t) => t.id === teamId);
    if (!team) return { ok: false, event: current, error: 'Team not found.' };

    if (!newLeaderId) {
      if (current.teamConfig.requireLeader && team.memberIds.length > 0) {
        return { ok: false, event: current, error: 'Event rules require a designated Team Leader.' };
      }
      return updateTeam(slug, teamId, { teamLeaderId: null });
    }

    if (!team.memberIds.includes(newLeaderId)) {
      return { ok: false, event: current, error: 'Team Leader must already belong to this team.' };
    }

    return updateTeam(slug, teamId, { teamLeaderId: newLeaderId });
  }

  function loadDemoRoster(slug) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const existingDemo = current.participants.some((p) => p.isDemo);
    if (existingDemo) {
      return { ok: false, event: current, error: 'Prototype demo roster is already loaded for this event.' };
    }

    const slugTag = slug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'EVNT';
    const baseTs = Date.now();
    const sampleProfiles = [
      { fullName: 'Aarav Nair', email: 'aarav.demo@campus.example', registrationStatus: 'Approved', institution: 'Pacific Ridge Tech', department: 'Computer Science', city: 'Bengaluru', track: 'Main Track', notes: 'Prototype demo entry' },
      { fullName: 'Meera Iyer', email: 'meera.demo@campus.example', registrationStatus: 'Approved', institution: 'Central SciEng', department: 'Design & HCI', city: 'Chennai', track: 'Main Track', notes: 'Prototype demo entry' },
      { fullName: 'Rohan Kulkarni', email: 'rohan.demo@campus.example', registrationStatus: 'Approved', institution: 'Western Innovation College', department: 'Electronics', city: 'Pune', track: 'Systems Track', notes: 'Prototype demo entry' },
      { fullName: 'Sanya Verma', email: 'sanya.demo@campus.example', registrationStatus: 'Pending', institution: 'Northbridge Univ', department: 'Data Science', city: 'Hyderabad', track: 'Open Track', notes: 'Awaiting organizer approval' },
      { fullName: 'Kabir Menon', email: 'kabir.demo@campus.example', registrationStatus: 'Waitlisted', institution: 'Southern Campus', department: 'Mechanical', city: 'Mumbai', track: 'Hardware', notes: 'Capacity waitlist sample' },
      { fullName: 'Diya Deshmukh', email: 'diya.demo@campus.example', registrationStatus: 'Approved', institution: 'Pacific Ridge Tech', department: 'Software Eng', city: 'Bengaluru', track: 'Main Track', notes: 'Unassigned participant sample' }
    ];

    const demoParticipants = sampleProfiles.map((sp, i) => normalizeParticipant({
      id: `prt_demo_${slugTag}_${i + 1}_${baseTs.toString(36)}`,
      eventId: slug,
      fullName: sp.fullName,
      email: sp.email,
      registrationId: `DEMO-${slugTag}-${101 + i}`,
      registrationStatus: sp.registrationStatus,
      registeredAt: new Date(baseTs - (6 - i) * 3600000).toISOString(),
      isDemo: true,
      metadata: {
        institution: sp.institution,
        department: sp.department,
        city: sp.city,
        track: sp.track,
        notes: sp.notes
      }
    }, slug, i));

    const nextParticipants = [...current.participants, ...demoParticipants];
    let nextTeams = [...current.teams];

    if (current.teamConfig.supported) {
      const cap = Math.max(2, Math.min(current.teamConfig.maxSize || 4, 4));
      const starterMembers = demoParticipants.slice(0, Math.min(2, cap)).map((p) => p.id);
      const demoTeam = normalizeTeam({
        id: `tm_demo_${slugTag}_1_${baseTs.toString(36)}`,
        eventId: slug,
        teamName: 'Demo Squad Alpha',
        description: 'Clearly labeled prototype demo team with open slot(s) for assignment testing.',
        teamLeaderId: starterMembers[0] || null,
        memberIds: starterMembers,
        maxTeamSize: cap,
        createdAt: new Date().toISOString(),
        isDemo: true
      }, slug, 0, cap);
      nextTeams = [demoTeam, ...nextTeams];
    }

    return saveEventRosterState(
      slug,
      nextParticipants,
      nextTeams,
      `Loaded prototype demo roster for "${current.name}"`,
      `${demoParticipants.length} clearly labeled demo registrant(s) added locally`
    );
  }

  function clearDemoRoster(slug) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const nextParticipants = current.participants.filter((p) => !p.isDemo);
    const demoSet = new Set(current.participants.filter((p) => p.isDemo).map((p) => p.id));
    const nextTeams = current.teams
      .filter((t) => !t.isDemo)
      .map((t) => ({
        ...t,
        memberIds: t.memberIds.filter((mid) => !demoSet.has(mid))
      }));

    return saveEventRosterState(
      slug,
      nextParticipants,
      nextTeams,
      `Cleared prototype demo roster for "${current.name}"`,
      'All demo participants and demo teams removed'
    );
  }

  /* ========================================================================
     PHASE 6: REGISTRATION SETTINGS, FORM BUILDER & PARTICIPANT FLOW APIS
     ======================================================================== */

  function getDefaultFormFields() {
    return buildDefaultFormFields();
  }

  function findExistingUserParticipant(ev, user) {
    if (!ev || !user) return null;
    const uid = user.id ? String(user.id) : '';
    const email = String(user.email || '').trim().toLowerCase();
    return (ev.participants || []).find((p) => {
      if (uid && p.userId && p.userId === uid) return true;
      if (email && p.email && p.email.toLowerCase() === email) return true;
      return false;
    }) || null;
  }

  function getActiveRegistrationCount(ev) {
    if (!ev || !Array.isArray(ev.participants)) return 0;
    return ev.participants.filter((p) => p.registrationStatus === 'Approved' || p.registrationStatus === 'Pending').length;
  }

  function evaluateRegistrationAvailability(evOrSlug, user, nowMsInput) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) {
      return { state: 'closed', canRegister: false, canWaitlist: false, reason: 'Event not found.', existingRegistration: null };
    }
    const cfg = ev.registrationConfig || normalizeRegistrationConfig({}, ev);
    const activeCount = getActiveRegistrationCount(ev);
    const capEnabled = Boolean(cfg.capacityEnabled);
    const maxRegs = Number(cfg.maxRegistrations) || 200;
    const seatsRemaining = capEnabled ? Math.max(0, maxRegs - activeCount) : null;
    const existing = user ? findExistingUserParticipant(ev, user) : null;
    const nowMs = typeof nowMsInput === 'number' ? nowMsInput : Date.now();

    if (existing && existing.registrationStatus !== 'Cancelled') {
      return {
        state: 'already_registered',
        canRegister: false,
        canWaitlist: false,
        existingRegistration: existing,
        activeCount,
        maxRegistrations: maxRegs,
        seatsRemaining,
        reason: `You already hold a ${existing.registrationStatus} registration (${existing.registrationId}).`
      };
    }

    if (ev.statusKey === 'cancelled' || ev.statusKey === 'completed') {
      return {
        state: 'closed',
        canRegister: false,
        canWaitlist: false,
        existingRegistration: existing,
        activeCount,
        maxRegistrations: maxRegs,
        seatsRemaining,
        reason: `Event is marked ${ev.eventStatus}. Registration is closed.`
      };
    }

    if (!cfg.registrationEnabled || String(ev.registrationStatus || '').toLowerCase() === 'closed') {
      return {
        state: 'closed',
        canRegister: false,
        canWaitlist: false,
        existingRegistration: existing,
        activeCount,
        maxRegistrations: maxRegs,
        seatsRemaining,
        reason: 'Organizer has closed registrations for this event.'
      };
    }

    if (cfg.registrationOpensAt) {
      const openMs = new Date(cfg.registrationOpensAt).getTime();
      if (!Number.isNaN(openMs) && nowMs < openMs) {
        return {
          state: 'not_open_yet',
          canRegister: false,
          canWaitlist: false,
          existingRegistration: existing,
          activeCount,
          maxRegistrations: maxRegs,
          seatsRemaining,
          reason: `Registration opens ${new Date(cfg.registrationOpensAt).toLocaleString()}.`
        };
      }
    }

    if (cfg.registrationClosesAt) {
      const closeMs = new Date(cfg.registrationClosesAt).getTime();
      if (!Number.isNaN(closeMs) && nowMs > closeMs) {
        return {
          state: 'closed',
          canRegister: false,
          canWaitlist: false,
          existingRegistration: existing,
          activeCount,
          maxRegistrations: maxRegs,
          seatsRemaining,
          reason: 'Registration window has closed.'
        };
      }
    }

    if (capEnabled && activeCount >= maxRegs) {
      if (cfg.waitlistEnabled) {
        return {
          state: 'waitlist_available',
          canRegister: true,
          canWaitlist: true,
          existingRegistration: existing,
          activeCount,
          maxRegistrations: maxRegs,
          seatsRemaining: 0,
          reason: 'Confirmed seats are full; waitlist registration is open.'
        };
      }
      return {
        state: 'full',
        canRegister: false,
        canWaitlist: false,
        existingRegistration: existing,
        activeCount,
        maxRegistrations: maxRegs,
        seatsRemaining: 0,
        reason: 'Maximum registration capacity reached and waitlist is disabled.'
      };
    }

    return {
      state: existing && existing.registrationStatus === 'Cancelled' ? 'cancelled_can_reapply' : 'open',
      canRegister: true,
      canWaitlist: false,
      existingRegistration: existing,
      activeCount,
      maxRegistrations: maxRegs,
      seatsRemaining,
      reason: ''
    };
  }

  function saveRegistrationConfig(slug, regPatch) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const patch = regPatch && typeof regPatch === 'object' ? regPatch : {};
    const merged = { ...current.registrationConfig, ...patch };

    if (merged.registrationOpensAt && merged.registrationClosesAt) {
      const oMs = new Date(merged.registrationOpensAt).getTime();
      const cMs = new Date(merged.registrationClosesAt).getTime();
      if (!Number.isNaN(oMs) && !Number.isNaN(cMs) && cMs < oMs) {
        return { ok: false, event: current, error: 'Registration close date/time must be after the open date/time.' };
      }
    }

    const capNum = Number(merged.maxRegistrations);
    if (merged.capacityEnabled && (!Number.isFinite(capNum) || capNum < 1)) {
      return { ok: false, event: current, error: 'Maximum registrations must be at least 1 when capacity limits are enabled.' };
    }

    const nextRegConfig = normalizeRegistrationConfig(merged, current);
    const nextRegStatus = patch.registrationStatus || (nextRegConfig.registrationEnabled ? (current.registrationStatus === 'Closed' ? 'Open' : current.registrationStatus) : 'Closed');
    const badgeMap = {
      'Open': 'ev-badge-open',
      'Filling Fast': 'ev-badge-filling',
      'Closing Soon': 'ev-badge-fast',
      'Closed': 'ev-badge-closed'
    };

    const res = updateEvent(slug, {
      registrationConfig: nextRegConfig,
      capacity: nextRegConfig.maxRegistrations,
      registrationStatus: nextRegStatus,
      registrationBadgeClass: badgeMap[nextRegStatus] || 'ev-badge-open',
      registrationDeadline: patch.registrationDeadline != null ? String(patch.registrationDeadline).trim() : current.registrationDeadline,
      _skipLog: true
    });
    if (res.ok && res.event) {
      logActivity('edit', `Updated registration settings for "${res.event.name}"`, `${nextRegStatus} • Approval: ${nextRegConfig.approvalMode}`, slug);
    }
    return { ok: Boolean(res.ok), event: res.event, error: res.ok ? '' : 'Failed to save registration configuration locally.' };
  }

  function saveRegistrationFormFields(slug, rawFields) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, event: null, error: 'Event not found.' };
    const list = Array.isArray(rawFields) ? rawFields : [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!String(f.label || '').trim()) {
        return { ok: false, event: current, error: `Field #${i + 1} needs a visible label.` };
      }
      if ((f.fieldType === 'dropdown' || f.fieldType === 'multiple_choice') && f.enabled !== false) {
        const opts = Array.isArray(f.options) ? f.options.filter(Boolean) : String(f.options || '').split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
        if (opts.length === 0) {
          return { ok: false, event: current, error: `"${f.label}" requires at least one selectable option.` };
        }
      }
    }
    const nextFields = list.map((f, idx) => normalizeFormField(f, idx));
    const nextRegConfig = normalizeRegistrationConfig({ ...current.registrationConfig, formFields: nextFields }, current);
    const res = updateEvent(slug, {
      registrationConfig: nextRegConfig,
      _skipLog: true
    });
    if (res.ok && res.event) {
      const enabledCount = nextRegConfig.formFields.filter((f) => f.enabled).length;
      logActivity('edit', `Saved registration form for "${res.event.name}"`, `${enabledCount} active field(s)`, slug);
    }
    return { ok: Boolean(res.ok), event: res.event, error: res.ok ? '' : 'Failed to save form fields.' };
  }

  function validateRegistrationSubmission(ev, submittedData) {
    const cfg = ev && ev.registrationConfig ? ev.registrationConfig : normalizeRegistrationConfig({}, ev);
    const data = submittedData && typeof submittedData === 'object' ? submittedData : {};
    const errors = {};
    const cleanData = {};

    (cfg.formFields || []).filter((f) => f.enabled !== false).forEach((f) => {
      const rawVal = data[f.key];
      if (f.fieldType === 'checkbox') {
        const checked = Boolean(rawVal);
        cleanData[f.key] = checked;
        if (f.required && !checked) {
          errors[f.key] = `Please check "${f.label}" to continue.`;
        }
        return;
      }

      const strVal = String(rawVal == null ? '' : rawVal).trim();
      cleanData[f.key] = strVal;

      if (f.required && !strVal) {
        errors[f.key] = `${f.label} is required.`;
        return;
      }
      if (!strVal) return;

      if (f.fieldType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(strVal)) {
        errors[f.key] = `Enter a valid email address for ${f.label}.`;
      } else if (f.fieldType === 'phone' && strVal.replace(/[^\d]/g, '').length < 7) {
        errors[f.key] = `Enter a valid phone number for ${f.label}.`;
      } else if (f.fieldType === 'number' && Number.isNaN(Number(strVal))) {
        errors[f.key] = `${f.label} must be a valid number.`;
      } else if (f.fieldType === 'url' && !/^https?:\/\/\S+/i.test(strVal)) {
        errors[f.key] = `${f.label} must start with https:// or http://.`;
      } else if ((f.fieldType === 'dropdown' || f.fieldType === 'multiple_choice') && f.options.length > 0 && !f.options.includes(strVal)) {
        errors[f.key] = `Select a valid option for ${f.label}.`;
      }
    });

    const firstKey = Object.keys(errors)[0];
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      firstError: firstKey ? errors[firstKey] : '',
      cleanData
    };
  }

  function generateUniqueRegistrationId(ev, slug) {
    const existing = new Set((ev.participants || []).map((p) => String(p.registrationId || '').toUpperCase()));
    const prefix = slug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'EVNT';
    let candidate = '';
    do {
      const rand = Math.floor(1000 + Math.random() * 9000);
      candidate = `REG-${prefix}-${rand}`;
    } while (existing.has(candidate));
    return candidate;
  }

  function submitEventRegistration(slug, user, payload) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    if (!user || (!user.id && !user.email)) {
      return { ok: false, error: 'Authentication is required before submitting an event registration.' };
    }

    const avail = evaluateRegistrationAvailability(current, user);
    if (!avail.canRegister) {
      return { ok: false, error: avail.reason || 'Registration is unavailable for this event.' };
    }

    const p = payload && typeof payload === 'object' ? payload : {};
    const valCheck = validateRegistrationSubmission(current, p.submittedData || {});
    if (!valCheck.valid) {
      return { ok: false, error: valCheck.firstError, fieldErrors: valCheck.errors };
    }

    const cleanData = valCheck.cleanData;
    const participantName = String(cleanData.fullName || user.fullName || 'Eventora Participant').trim();
    const participantEmail = String(cleanData.email || user.email || '').trim().toLowerCase();
    const cfg = current.registrationConfig;
    const finalStatus = avail.canWaitlist
      ? 'Waitlisted'
      : (cfg.approvalMode === 'manual' ? 'Pending' : 'Approved');

    const tc = current.teamConfig;
    const choice = tc.supported ? String(p.participationChoice || 'form_later') : 'individual';
    const teamPayload = p.teamPayload && typeof p.teamPayload === 'object' ? p.teamPayload : {};

    // Reuse previous cancelled participant record ID if re-applying, else create new record
    const existingCancelled = avail.existingRegistration && avail.existingRegistration.registrationStatus === 'Cancelled'
      ? avail.existingRegistration
      : null;
    const participantId = existingCancelled ? existingCancelled.id : createParticipantId();
    const regId = existingCancelled ? existingCancelled.registrationId : generateUniqueRegistrationId(current, slug);
    const nowIso = new Date().toISOString();

    let nextTeams = [...current.teams];
    let assignedTeamId = null;

    if (tc.supported) {
      if (choice === 'create_team') {
        if (tc.locked) return { ok: false, error: 'Team membership is locked for this event.' };
        if (tc.creationMode === 'organizer_only') return { ok: false, error: 'Organizer-only team creation is enforced on this event.' };
        const tName = String(teamPayload.teamName || '').trim();
        if (!tName || tName.length < 2) return { ok: false, error: 'Enter a team name (at least 2 characters).' };
        if (nextTeams.some((t) => t.teamName.toLowerCase() === tName.toLowerCase())) {
          return { ok: false, error: `A team named "${tName}" already exists in this event.` };
        }
        const tMax = Number(teamPayload.maxTeamSize != null && teamPayload.maxTeamSize !== '' ? teamPayload.maxTeamSize : tc.maxSize);
        if (!Number.isFinite(tMax) || tMax < 1 || tMax > tc.maxSize) {
          return { ok: false, error: `Team capacity must be between 1 and ${tc.maxSize}.` };
        }
        const createdTeam = normalizeTeam({
          id: createTeamId(),
          eventId: slug,
          teamName: tName,
          description: String(teamPayload.description || '').trim(),
          teamLeaderId: participantId,
          memberIds: [participantId],
          maxTeamSize: Math.floor(tMax),
          createdAt: nowIso,
          isDemo: false
        }, slug, nextTeams.length, tc.maxSize);
        assignedTeamId = createdTeam.id;
        nextTeams = [createdTeam, ...nextTeams];
      } else if (choice === 'join_team') {
        if (tc.locked) return { ok: false, error: 'Team membership is locked for this event.' };
        if (!tc.allowJoinExisting) return { ok: false, error: 'Joining existing teams directly is disabled by event rules.' };
        const joinId = String(teamPayload.teamId || '').trim();
        const targetTeam = nextTeams.find((t) => t.id === joinId);
        if (!targetTeam) return { ok: false, error: 'Selected team was not found in this event.' };
        if (targetTeam.memberIds.length >= targetTeam.maxTeamSize) {
          return { ok: false, error: `Team "${targetTeam.teamName}" is already full.` };
        }
        assignedTeamId = targetTeam.id;
        nextTeams = nextTeams.map((t) =>
          t.id === joinId
            ? {
                ...t,
                memberIds: [...t.memberIds, participantId],
                teamLeaderId: t.teamLeaderId || (tc.requireLeader ? participantId : null)
              }
            : t
        );
      } else if (choice === 'request_team' && !tc.allowJoinRequests) {
        return { ok: false, error: 'Team formation requests are not enabled for this event.' };
      }
    }

    const newParticipant = normalizeParticipant({
      id: participantId,
      eventId: slug,
      userId: user.id ? String(user.id) : null,
      fullName: participantName,
      email: participantEmail,
      registrationId: regId,
      registrationStatus: finalStatus,
      registeredAt: nowIso,
      updatedAt: nowIso,
      teamId: assignedTeamId,
      isDemo: false,
      participationChoice: choice,
      teamRequestNote: choice === 'request_team' ? String(teamPayload.requestNote || '').trim() : '',
      submittedData: cleanData,
      cancellation: null
    }, slug, current.participants.length);

    const nextParticipants = existingCancelled
      ? current.participants.map((item) => (item.id === participantId ? newParticipant : item))
      : [newParticipant, ...current.participants];

    const saveRes = saveEventRosterState(
      slug,
      nextParticipants,
      nextTeams,
      `Submitted registration for "${current.name}"`,
      `${participantName} (${regId}) • ${finalStatus}`
    );
    if (!saveRes.ok) {
      return { ok: false, error: saveRes.error || 'Could not save registration locally.' };
    }

    const savedReg = saveRes.event.participants.find((item) => item.id === participantId);
    return {
      ok: true,
      event: saveRes.event,
      registration: savedReg,
      registrationStatus: finalStatus,
      registrationId: regId,
      team: assignedTeamId ? saveRes.event.teams.find((t) => t.id === assignedTeamId) : null
    };
  }

  function updateUserRegistration(slug, user, payload) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const existing = findExistingUserParticipant(current, user);
    if (!existing) return { ok: false, error: 'No registration record found for your account on this event.' };
    if (existing.registrationStatus === 'Cancelled' || existing.registrationStatus === 'Rejected') {
      return { ok: false, error: `Cannot edit a ${existing.registrationStatus} registration.` };
    }
    if (current.statusKey === 'cancelled' || current.statusKey === 'completed') {
      return { ok: false, error: 'Event is closed; registration editing is locked.' };
    }

    const valCheck = validateRegistrationSubmission(current, (payload && payload.submittedData) || {});
    if (!valCheck.valid) {
      return { ok: false, error: valCheck.firstError, fieldErrors: valCheck.errors };
    }

    const cleanData = valCheck.cleanData;
    const updatedName = String(cleanData.fullName || existing.fullName).trim();
    const updatedEmail = String(cleanData.email || existing.email).trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const nextParticipants = current.participants.map((p) => (
      p.id === existing.id
        ? normalizeParticipant({
            ...p,
            fullName: updatedName,
            email: updatedEmail,
            submittedData: cleanData,
            updatedAt: nowIso
          }, slug, 0)
        : p
    ));

    const res = saveEventRosterState(
      slug,
      nextParticipants,
      current.teams,
      `Updated registration details for "${current.name}"`,
      existing.registrationId
    );
    return {
      ok: Boolean(res.ok),
      event: res.event,
      registration: res.event ? res.event.participants.find((p) => p.id === existing.id) : null,
      error: res.error
    };
  }

  function isCancellationAllowedNow(ev, existingReg, nowMsInput) {
    if (!ev || !existingReg) return { allowed: false, reason: 'Registration not found.' };
    if (existingReg.registrationStatus === 'Cancelled') return { allowed: false, reason: 'Already cancelled.' };
    if (existingReg.registrationStatus === 'Rejected') return { allowed: false, reason: 'Rejected registrations cannot be cancelled.' };
    const cfg = ev.registrationConfig || {};
    if (cfg.cancellationAllowed === false) {
      return { allowed: false, reason: 'Cancellation is disabled for this event.' };
    }
    const nowMs = typeof nowMsInput === 'number' ? nowMsInput : Date.now();
    if (cfg.cancellationDeadline) {
      const deadMs = new Date(cfg.cancellationDeadline).getTime();
      if (!Number.isNaN(deadMs) && nowMs > deadMs) {
        return { allowed: false, reason: `Cancellation deadline passed (${new Date(cfg.cancellationDeadline).toLocaleString()}).` };
      }
    }
    return { allowed: true, reason: '' };
  }

  function cancelUserRegistration(slug, user, reason, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const existing = findExistingUserParticipant(current, user);
    if (!existing) return { ok: false, error: 'Registration not found.' };

    const check = isCancellationAllowedNow(current, existing, nowMsInput);
    if (!check.allowed) return { ok: false, error: check.reason };

    const nowIso = new Date().toISOString();
    const nextParticipants = current.participants.map((p) => (
      p.id === existing.id
        ? {
            ...p,
            registrationStatus: 'Cancelled',
            updatedAt: nowIso,
            teamId: null,
            cancellation: {
              cancelledAt: nowIso,
              reason: String(reason || 'Cancelled by participant').trim()
            }
          }
        : p
    ));

    // Remove participant cleanly from any team; auto-promote next member if leader leaves so team remains consistent
    const nextTeams = current.teams.map((t) => {
      if (!(t.memberIds || []).includes(existing.id)) return t;
      const remaining = t.memberIds.filter((mid) => mid !== existing.id);
      let nextLeader = t.teamLeaderId;
      if (nextLeader === existing.id) {
        nextLeader = remaining.length > 0 && current.teamConfig.requireLeader ? remaining[0] : null;
      }
      return { ...t, memberIds: remaining, teamLeaderId: nextLeader };
    });

    const res = saveEventRosterState(
      slug,
      nextParticipants,
      nextTeams,
      `Cancelled registration for "${current.name}"`,
      `${existing.registrationId}`
    );
    return {
      ok: Boolean(res.ok),
      event: res.event,
      registration: res.event ? res.event.participants.find((p) => p.id === existing.id) : null,
      error: res.error
    };
  }

  function getUserRegistrations(user) {
    if (!user || (!user.id && !user.email)) return [];
    const results = [];
    getAllEvents().forEach((ev) => {
      const reg = findExistingUserParticipant(ev, user);
      if (!reg) return;
      const team = reg.teamId ? (ev.teams || []).find((t) => t.id === reg.teamId) : null;
      results.push({
        event: ev,
        registration: reg,
        team
      });
    });
    results.sort((a, b) => new Date(b.registration.registeredAt || 0) - new Date(a.registration.registeredAt || 0));
    return results;
  }

  function getUserTeams(user) {
    if (!user || (!user.id && !user.email)) return [];
    const results = [];
    getAllEvents().forEach((ev) => {
      const reg = findExistingUserParticipant(ev, user);
      if (!reg || reg.registrationStatus === 'Cancelled' || reg.registrationStatus === 'Rejected') return;
      (ev.teams || []).forEach((team) => {
        if ((team.memberIds || []).includes(reg.id)) {
          results.push({ event: ev, registration: reg, team });
        }
      });
    });
    return results;
  }

  function participantCreateTeam(slug, user, { teamName, description, maxTeamSize }) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    if (!current.teamConfig.supported) return { ok: false, error: 'Individual event: team creation is disabled.' };
    if (current.teamConfig.locked) return { ok: false, error: 'Team membership is locked by the organizer.' };
    if (current.teamConfig.creationMode === 'organizer_only') {
      return { ok: false, error: 'This event only allows organizer-created teams.' };
    }
    const reg = findExistingUserParticipant(current, user);
    if (!reg || reg.registrationStatus === 'Cancelled' || reg.registrationStatus === 'Rejected') {
      return { ok: false, error: 'Register for this event before creating a team.' };
    }
    return createTeam(slug, {
      teamName,
      description,
      maxTeamSize: maxTeamSize || current.teamConfig.maxSize,
      memberIds: [reg.id],
      teamLeaderId: reg.id
    });
  }

  function participantJoinTeamById(slug, user, teamId) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    if (!current.teamConfig.supported) return { ok: false, error: 'Individual event: teams are disabled.' };
    if (current.teamConfig.locked) return { ok: false, error: 'Team membership is locked by the organizer.' };
    if (!current.teamConfig.allowJoinExisting) return { ok: false, error: 'Joining existing teams directly is disabled.' };
    const reg = findExistingUserParticipant(current, user);
    if (!reg || reg.registrationStatus === 'Cancelled' || reg.registrationStatus === 'Rejected') {
      return { ok: false, error: 'Register for this event before joining a team.' };
    }
    return assignMembersToTeam(slug, teamId, [reg.id]);
  }

  function participantLeaveTeam(slug, user, teamId) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    if (current.teamConfig.locked) return { ok: false, error: 'Team membership is locked by the organizer.' };
    const reg = findExistingUserParticipant(current, user);
    if (!reg) return { ok: false, error: 'Participant registration not found.' };
    const team = (current.teams || []).find((t) => t.id === teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    const remaining = team.memberIds.filter((mid) => mid !== reg.id);
    if (remaining.length === 0) {
      return deleteTeam(slug, teamId);
    }
    const replacementLeader = reg.id === team.teamLeaderId ? remaining[0] : undefined;
    return removeMemberFromTeam(slug, teamId, reg.id, replacementLeader);
  }

  function appendLiveActivity(ops, eventSlug, entry) {
    const actorRef = formatActorRef(entry.actor);
    const list = Array.isArray(ops.activityTimeline) ? [...ops.activityTimeline] : [];
    list.unshift({
      id: createLiveActivityId(),
      eventId: String(eventSlug || ''),
      roundId: entry.roundId ? String(entry.roundId) : null,
      activityType: String(entry.activityType || 'operation').trim(),
      description: String(entry.description || '').trim(),
      timestamp: entry.timestamp || new Date().toISOString(),
      actorId: actorRef.actorId,
      actorName: actorRef.actorName
    });
    ops.activityTimeline = list.slice(0, 120);
  }

  function saveLiveOpsState(slug, nextOps, activitySummary) {
    const res = updateEvent(slug, {
      liveOps: nextOps,
      _skipLog: true
    });
    if (res.ok && res.event && activitySummary) {
      logActivity(
        'live',
        activitySummary.title || `Live operation on "${res.event.name}"`,
        activitySummary.detail || '',
        slug
      );
    }
    return {
      ok: Boolean(res.ok),
      event: res.event,
      error: res.ok ? '' : 'Unable to persist live operations in browser sessionStorage.'
    };
  }

  function buildPresentationOrderForRound(ev, round, existingOrder) {
    const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
    const slotMins = Math.max(1, Number(round && round.typeConfig && round.typeConfig.durationPerPresentationMin) || 8);
    const eligibleEntries = useTeams
      ? (ev.teams || []).map((t) => ({
          key: `team:${t.id}`,
          kind: 'team',
          refId: t.id,
          label: t.teamName || t.name || 'Team',
          slotMinutes: slotMins
        }))
      : (ev.participants || [])
          .filter((p) => p.registrationStatus !== 'Cancelled' && p.registrationStatus !== 'Rejected')
          .map((p) => ({
            key: `participant:${p.id}`,
            kind: 'participant',
            refId: p.id,
            label: p.fullName,
            slotMinutes: slotMins
          }));

    const existingMap = new Map((Array.isArray(existingOrder) ? existingOrder : []).map((x) => [x.key, x]));
    const ordered = [];
    const seen = new Set();

    (Array.isArray(existingOrder) ? existingOrder : []).forEach((oldItem) => {
      const fresh = eligibleEntries.find((e) => e.key === oldItem.key);
      if (fresh && !seen.has(fresh.key)) {
        seen.add(fresh.key);
        ordered.push({
          ...fresh,
          status: LIVE_PARTICIPATION_STATUSES.includes(oldItem.status) ? oldItem.status : 'Not Started',
          notes: String(oldItem.notes || '')
        });
      }
    });

    eligibleEntries.forEach((fresh) => {
      if (!seen.has(fresh.key)) {
        seen.add(fresh.key);
        const old = existingMap.get(fresh.key);
        ordered.push({
          ...fresh,
          status: old && LIVE_PARTICIPATION_STATUSES.includes(old.status) ? old.status : 'Not Started',
          notes: old ? String(old.notes || '') : ''
        });
      }
    });

    return ordered;
  }

  function syncExpiredRoundTimers(slug, nowMsInput, actor) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, changed: false, event: null };
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ops = normalizeLiveOps(current.liveOps, current);
    let changed = false;

    (current.rounds || []).forEach((r) => {
      const roundOp = ops.roundsById[r.id];
      if (!roundOp) return;
      if (roundOp.roundStatus === 'Live' && roundOp.timerState === 'Running') {
        const snap = computeTimerSnapshot(roundOp, nowMs);
        if (snap.hasDuration && snap.isExpired) {
          roundOp.timerState = 'Expired';
          roundOp.remainingSecondsSnapshot = 0;
          const totalMs = snap.totalDurationSeconds * 1000;
          const startedMs = Date.parse(roundOp.startedAt);
          const accPaused = Number(roundOp.accumulatedPausedMs) || 0;
          const exactExpiryMs = Number.isNaN(startedMs) ? nowMs : Math.min(nowMs, startedMs + accPaused + totalMs);
          roundOp.endedAt = roundOp.endedAt || new Date(exactExpiryMs).toISOString();
          if (!roundOp.expiredNoticeLogged) {
            roundOp.expiredNoticeLogged = true;
            appendLiveActivity(ops, slug, {
              roundId: r.id,
              activityType: 'timer_expired',
              description: `Countdown expired for Round ${r.order} ("${r.name}").`,
              timestamp: nowIso,
              actor
            });
          }
          ops.operationsUpdatedAt = nowIso;
          changed = true;
        }
      }
    });

    if (!changed) {
      return { ok: true, changed: false, event: current };
    }
    const saved = saveLiveOpsState(slug, ops, null);
    return { ok: saved.ok, changed: true, event: saved.event || current };
  }

  function getLiveOperationsSnapshot(slug, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput);
    const ev = synced.event || getEventBySlug(slug);
    if (!ev) return null;
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const ops = normalizeLiveOps(ev.liveOps, ev);
    const timersByRoundId = {};
    (ev.rounds || []).forEach((r) => {
      timersByRoundId[r.id] = computeTimerSnapshot(ops.roundsById[r.id], nowMs);
    });
    return {
      event: ev,
      liveOps: ops,
      timersByRoundId,
      nowMs
    };
  }

  function setLiveConcurrentMode(slug, allowConcurrent, actor) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const nextFlag = Boolean(allowConcurrent);
    if (ops.allowConcurrentRounds === nextFlag) return { ok: true, event: current };
    const nowIso = new Date().toISOString();
    ops.allowConcurrentRounds = nextFlag;
    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: null,
      activityType: 'config_updated',
      description: nextFlag ? 'Enabled concurrent active rounds in Live Control.' : 'Disabled concurrent rounds (enforced sequential single-active round).',
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, null);
  }

  function startLiveEvent(slug, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    if (current.statusKey === 'cancelled') {
      return { ok: false, error: 'Cannot start a Cancelled event.' };
    }
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Event is already Completed. Reopen explicitly if changes are required.' };
    }
    if (ops.operationalStatus === 'Live') {
      return { ok: false, error: 'Event is already Live.' };
    }
    if (ops.operationalStatus === 'Paused') {
      return { ok: false, error: 'Event is currently Paused. Use Resume Event to continue.' };
    }
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    ops.operationalStatus = 'Live';
    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: null,
      activityType: 'event_started',
      description: `Marked "${current.name}" Live.`,
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, {
      title: `Started live operations for "${current.name}"`,
      detail: `${(current.rounds || []).length} configured round(s)`
    });
  }

  function pauseLiveEvent(slug, actor, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus !== 'Live') {
      return { ok: false, error: `Only a Live event can be paused (current status: ${ops.operationalStatus}).` };
    }
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const pausedRounds = [];

    (current.rounds || []).forEach((r) => {
      const roundOp = ops.roundsById[r.id];
      if (roundOp && roundOp.roundStatus === 'Live') {
        const snap = computeTimerSnapshot(roundOp, nowMs);
        roundOp.roundStatus = 'Paused';
        roundOp.pausedAt = nowIso;
        roundOp.pausedByEventPause = true;
        roundOp.remainingSecondsSnapshot = snap.remainingSeconds;
        if (roundOp.timerState === 'Running') {
          roundOp.timerState = 'Paused';
        }
        pausedRounds.push(r.name);
      }
    });

    ops.operationalStatus = 'Paused';
    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: ops.currentRoundId,
      activityType: 'event_paused',
      description: pausedRounds.length
        ? `Paused event operations and froze active timer(s): ${pausedRounds.join(', ')}.`
        : 'Paused event operations.',
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, {
      title: `Paused live operations for "${current.name}"`,
      detail: pausedRounds.length ? `Frozen: ${pausedRounds.join(', ')}` : 'No running round timers'
    });
  }

  function resumeLiveEvent(slug, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Completed events cannot be resumed directly.' };
    }
    if (ops.operationalStatus !== 'Paused') {
      return { ok: false, error: 'Only a Paused event can be resumed.' };
    }
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const resumedRounds = [];

    (current.rounds || []).forEach((r) => {
      const roundOp = ops.roundsById[r.id];
      if (roundOp && roundOp.roundStatus === 'Paused' && roundOp.pausedByEventPause) {
        if (roundOp.pausedAt) {
          const pausedAtMs = Date.parse(roundOp.pausedAt);
          if (!Number.isNaN(pausedAtMs) && nowMs > pausedAtMs) {
            roundOp.accumulatedPausedMs = (Number(roundOp.accumulatedPausedMs) || 0) + (nowMs - pausedAtMs);
          }
        }
        roundOp.roundStatus = 'Live';
        roundOp.pausedAt = '';
        roundOp.pausedByEventPause = false;
        if (roundOp.timerState === 'Paused') {
          roundOp.timerState = 'Running';
        }
        resumedRounds.push(r.name);
      }
    });

    ops.operationalStatus = 'Live';
    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: ops.currentRoundId,
      activityType: 'event_resumed',
      description: resumedRounds.length
        ? `Resumed event operations and continued timer(s): ${resumedRounds.join(', ')}.`
        : 'Resumed event operations.',
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, {
      title: `Resumed "${current.name}" Live`,
      detail: resumedRounds.length ? `Resumed: ${resumedRounds.join(', ')}` : 'Ready for round controls'
    });
  }

  function completeLiveEvent(slug, actor, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Event is already Completed.' };
    }
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    (current.rounds || []).forEach((r) => {
      const roundOp = ops.roundsById[r.id];
      if (!roundOp) return;
      if (roundOp.roundStatus === 'Live' || roundOp.roundStatus === 'Paused') {
        const snap = computeTimerSnapshot(roundOp, nowMs);
        roundOp.remainingSecondsSnapshot = snap.remainingSeconds;
        roundOp.endedAt = roundOp.endedAt || nowIso;
        roundOp.pausedAt = '';
        roundOp.pausedByEventPause = false;
        if (roundOp.timerState === 'Running' || roundOp.timerState === 'Paused') {
          roundOp.timerState = 'Ended';
        }
        roundOp.roundStatus = 'Completed';
      }
    });

    ops.operationalStatus = 'Completed';
    ops.completedAt = nowIso;
    ops.operationsUpdatedAt = nowIso;
    ops.currentRoundId = null;

    appendLiveActivity(ops, slug, {
      roundId: null,
      activityType: 'event_completed',
      description: `Marked "${current.name}" Completed. Completed rounds, participant records, and registrations preserved.`,
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, {
      title: `Completed event "${current.name}"`,
      detail: 'Event live operations finalized'
    });
  }

  function reopenLiveEvent(slug, actor, opts, nowMsInput) {
    if (!opts || !opts.confirmed) {
      return { ok: false, error: 'Explicit confirmation is required to reopen a completed event.' };
    }
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus !== 'Completed') {
      return { ok: false, error: 'Event is not Completed.' };
    }
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    ops.operationalStatus = 'Paused';
    ops.completedAt = '';
    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: null,
      activityType: 'event_reopened',
      description: `Deliberately reopened "${current.name}" into Paused state for organizer review.`,
      timestamp: nowIso,
      actor
    });
    return saveLiveOpsState(slug, ops, {
      title: `Reopened "${current.name}" operations`,
      detail: 'Moved from Completed to Paused'
    });
  }

  function startLiveRound(slug, roundId, actor, opts, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const options = opts && typeof opts === 'object' ? opts : {};
    const ops = normalizeLiveOps(current.liveOps, current);

    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Event is Completed. Start new rounds is blocked.' };
    }
    if (ops.operationalStatus === 'Paused') {
      return { ok: false, error: 'Event operations are Paused. Resume the event before starting a round.' };
    }

    const round = (current.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Configured round not found for this event.' };
    const roundOp = ops.roundsById[round.id];
    if (!roundOp) return { ok: false, error: 'Round operations state missing.' };

    if (round.enabled === false || round.status === 'Disabled' || roundOp.roundStatus === 'Cancelled') {
      return { ok: false, error: `"${round.name}" is disabled or cancelled and cannot be started.` };
    }
    if (roundOp.roundStatus === 'Completed') {
      return { ok: false, error: `Round ${round.order} ("${round.name}") is already Completed and cannot be restarted.` };
    }
    if (roundOp.roundStatus === 'Live' || roundOp.roundStatus === 'Paused') {
      return { ok: false, error: `Round ${round.order} ("${round.name}") is already ${roundOp.roundStatus}.` };
    }

    if (!ops.allowConcurrentRounds) {
      const blocking = (current.rounds || []).find((other) => {
        if (other.id === round.id) return false;
        const oOp = ops.roundsById[other.id];
        return oOp && (oOp.roundStatus === 'Live' || oOp.roundStatus === 'Paused');
      });
      if (blocking) {
        return {
          ok: false,
          error: `Round ${blocking.order} ("${blocking.name}") is currently ${ops.roundsById[blocking.id].roundStatus}. Complete it first or allow concurrent rounds.`
        };
      }
    }

    // Check earlier uncompleted/unstarted rounds so organizers cannot silently skip rounds.
    const skippedRounds = (current.rounds || []).filter((earlier) => {
      if (earlier.order >= round.order) return false;
      if (earlier.enabled === false || earlier.status === 'Disabled') return false;
      const eOp = ops.roundsById[earlier.id];
      return eOp && (eOp.roundStatus === 'Upcoming' || eOp.roundStatus === 'Live' || eOp.roundStatus === 'Paused');
    });

    if (skippedRounds.length > 0 && !options.confirmSkip) {
      return {
        ok: false,
        requiresSkipConfirmation: true,
        skippedRounds: skippedRounds.map((s) => ({ id: s.id, order: s.order, name: s.name })),
        error: `Earlier round(s) (${skippedRounds.map((s) => `R${s.order}`).join(', ')}) have not been completed yet. Confirm to start out of sequence.`
      };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (ops.operationalStatus === 'Upcoming') {
      ops.operationalStatus = 'Live';
      appendLiveActivity(ops, slug, {
        roundId: round.id,
        activityType: 'event_started',
        description: `Marked "${current.name}" Live automatically on starting Round ${round.order}.`,
        timestamp: nowIso,
        actor
      });
    }

    if (skippedRounds.length > 0 && options.confirmSkip) {
      appendLiveActivity(ops, slug, {
        roundId: round.id,
        activityType: 'round_skipped',
        description: `Manually skipped ahead to Round ${round.order} ("${round.name}") past ${skippedRounds.map((s) => `Round ${s.order} (${s.name})`).join(', ')}.`,
        timestamp: nowIso,
        actor
      });
    }

    const durSecs = parseDurationToSeconds(round);
    roundOp.roundStatus = 'Live';
    roundOp.durationSeconds = durSecs;
    roundOp.startedAt = nowIso;
    roundOp.pausedAt = '';
    roundOp.endedAt = '';
    roundOp.accumulatedPausedMs = 0;
    roundOp.remainingSecondsSnapshot = durSecs;
    roundOp.timerState = 'Running';
    roundOp.pausedByEventPause = false;
    roundOp.expiredNoticeLogged = false;
    roundOp.roundEndedAwaitingCompletion = false;

    if (round.typeKey === 'presentation') {
      roundOp.presentationOrder = buildPresentationOrderForRound(current, round, roundOp.presentationOrder);
    }

    ops.currentRoundId = round.id;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'round_started',
      description: `Started Round ${round.order} ("${round.name}"${durSecs > 0 ? `, ${Math.round(durSecs / 60)}m timer` : ', untimed'}).`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Started Round ${round.order}: ${round.name}`,
      detail: `Event: ${current.name}`
    });
  }

  function pauseLiveRound(slug, roundId, actor, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const round = (current.rounds || []).find((r) => r.id === roundId);
    const roundOp = round ? ops.roundsById[round.id] : null;
    if (!round || !roundOp) return { ok: false, error: 'Round not found.' };
    if (roundOp.roundStatus !== 'Live') {
      return { ok: false, error: `Only a Live round can be paused (current status: ${roundOp.roundStatus}).` };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const snap = computeTimerSnapshot(roundOp, nowMs);

    roundOp.roundStatus = 'Paused';
    roundOp.pausedAt = nowIso;
    roundOp.pausedByEventPause = false;
    roundOp.remainingSecondsSnapshot = snap.remainingSeconds;
    if (roundOp.timerState === 'Running') {
      roundOp.timerState = snap.isExpired ? 'Expired' : 'Paused';
    }
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'round_paused',
      description: `Paused Round ${round.order} ("${round.name}").`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Paused Round ${round.order}: ${round.name}`,
      detail: `Remaining snapshot: ${snap.remainingSeconds}s`
    });
  }

  function resumeLiveRound(slug, roundId, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Completed event cannot resume rounds.' };
    }
    if (ops.operationalStatus === 'Paused') {
      return { ok: false, error: 'Event operations are Paused. Resume the event before resuming individual rounds.' };
    }

    const round = (current.rounds || []).find((r) => r.id === roundId);
    const roundOp = round ? ops.roundsById[round.id] : null;
    if (!round || !roundOp) return { ok: false, error: 'Round not found.' };
    if (roundOp.roundStatus === 'Completed') {
      return { ok: false, error: 'Completed rounds cannot be resumed.' };
    }
    if (roundOp.roundStatus !== 'Paused') {
      return { ok: false, error: `Only a Paused round can be resumed (current status: ${roundOp.roundStatus}).` };
    }
    if (roundOp.timerState === 'Ended') {
      return { ok: false, error: 'Timer has already been ended for this round. Extend the timer or mark it Completed.' };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (roundOp.pausedAt) {
      const pausedAtMs = Date.parse(roundOp.pausedAt);
      if (!Number.isNaN(pausedAtMs) && nowMs > pausedAtMs) {
        roundOp.accumulatedPausedMs = (Number(roundOp.accumulatedPausedMs) || 0) + (nowMs - pausedAtMs);
      }
    }

    roundOp.pausedAt = '';
    roundOp.pausedByEventPause = false;
    roundOp.roundStatus = 'Live';
    roundOp.timerState = roundOp.timerState === 'Expired' ? 'Expired' : 'Running';
    const postSnap = computeTimerSnapshot(roundOp, nowMs);
    if (postSnap.hasDuration && postSnap.isExpired) {
      roundOp.timerState = 'Expired';
    }
    roundOp.remainingSecondsSnapshot = postSnap.remainingSeconds;
    ops.currentRoundId = round.id;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'round_resumed',
      description: `Resumed Round ${round.order} ("${round.name}").`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Resumed Round ${round.order}: ${round.name}`,
      detail: `Remaining: ${postSnap.remainingSeconds}s`
    });
  }

  function endLiveRound(slug, roundId, actor, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const round = (current.rounds || []).find((r) => r.id === roundId);
    const roundOp = round ? ops.roundsById[round.id] : null;
    if (!round || !roundOp) return { ok: false, error: 'Round not found.' };
    if (roundOp.roundStatus !== 'Live' && roundOp.roundStatus !== 'Paused') {
      return { ok: false, error: `Only a Live or Paused round can be ended (current status: ${roundOp.roundStatus}).` };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const snap = computeTimerSnapshot(roundOp, nowMs);

    roundOp.timerState = 'Ended';
    roundOp.endedAt = nowIso;
    roundOp.pausedAt = '';
    roundOp.pausedByEventPause = false;
    roundOp.roundStatus = 'Paused';
    roundOp.remainingSecondsSnapshot = snap.remainingSeconds;
    roundOp.roundEndedAwaitingCompletion = true;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'round_ended',
      description: `Ended active timer for Round ${round.order} ("${round.name}"). Ready to review and mark Completed.`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Ended timer for Round ${round.order}`,
      detail: round.name
    });
  }

  function completeLiveRound(slug, roundId, actor, nowMsInput) {
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const round = (current.rounds || []).find((r) => r.id === roundId);
    const roundOp = round ? ops.roundsById[round.id] : null;
    if (!round || !roundOp) return { ok: false, error: 'Round not found.' };

    if (roundOp.roundStatus === 'Completed') {
      return { ok: false, error: `Round ${round.order} is already Completed.` };
    }
    if (roundOp.roundStatus !== 'Live' && roundOp.roundStatus !== 'Paused') {
      return { ok: false, error: `Cannot mark an ${roundOp.roundStatus} round Completed without starting it first.` };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const snap = computeTimerSnapshot(roundOp, nowMs);

    roundOp.roundStatus = 'Completed';
    if (roundOp.timerState !== 'Expired') {
      roundOp.timerState = 'Ended';
    }
    roundOp.endedAt = roundOp.endedAt || nowIso;
    roundOp.pausedAt = '';
    roundOp.pausedByEventPause = false;
    roundOp.remainingSecondsSnapshot = snap.remainingSeconds;
    roundOp.roundEndedAwaitingCompletion = false;

    const nextActive = (current.rounds || []).find((r) => {
      if (r.id === round.id) return false;
      const oOp = ops.roundsById[r.id];
      return oOp && (oOp.roundStatus === 'Live' || oOp.roundStatus === 'Paused');
    });
    ops.currentRoundId = nextActive ? nextActive.id : null;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'round_completed',
      description: `Marked Round ${round.order} ("${round.name}") Completed.`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Completed Round ${round.order}: ${round.name}`,
      detail: `Event: ${current.name}`
    });
  }

  function advanceToNextRound(slug, actor, opts, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    if (ops.operationalStatus === 'Completed') {
      return { ok: false, error: 'Event is already Completed.' };
    }
    if (ops.operationalStatus === 'Paused') {
      return { ok: false, error: 'Resume the event before advancing rounds.' };
    }

    const enabledRounds = (current.rounds || []).filter((r) => {
      const rOp = ops.roundsById[r.id];
      return r.enabled !== false && r.status !== 'Disabled' && rOp && rOp.roundStatus !== 'Cancelled';
    });
    if (!enabledRounds.length) {
      return { ok: false, error: 'No enabled rounds configured for this event.' };
    }

    let currentIdx = -1;
    if (ops.currentRoundId) {
      currentIdx = enabledRounds.findIndex((r) => r.id === ops.currentRoundId);
    } else {
      // Find latest completed round index
      for (let i = enabledRounds.length - 1; i >= 0; i -= 1) {
        if (ops.roundsById[enabledRounds[i].id].roundStatus === 'Completed') {
          currentIdx = i;
          break;
        }
      }
    }

    const nextRound = enabledRounds[currentIdx + 1] || null;
    if (!nextRound) {
      return { ok: false, error: 'No next round available. Already at the final configured round.' };
    }

    if (currentIdx >= 0) {
      const prevRound = enabledRounds[currentIdx];
      const prevOp = ops.roundsById[prevRound.id];
      if (prevOp && (prevOp.roundStatus === 'Live' || prevOp.roundStatus === 'Paused')) {
        const compRes = completeLiveRound(slug, prevRound.id, actor, nowMsInput);
        if (!compRes.ok) return compRes;
      }
    }

    return startLiveRound(slug, nextRound.id, actor, { ...(opts || {}), confirmSkip: true }, nowMsInput);
  }

  function extendRoundTimer(slug, roundId, minutes, reason, actor, nowMsInput) {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0 || mins > 720) {
      return { ok: false, error: 'Enter a valid extension between 1 and 720 minutes.' };
    }
    const synced = syncExpiredRoundTimers(slug, nowMsInput, actor);
    const current = synced.event || getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const round = (current.rounds || []).find((r) => r.id === roundId);
    const roundOp = round ? ops.roundsById[round.id] : null;
    if (!round || !roundOp) return { ok: false, error: 'Round not found.' };
    if (roundOp.roundStatus !== 'Live' && roundOp.roundStatus !== 'Paused') {
      return { ok: false, error: 'Only a Live or Paused round timer can be extended.' };
    }
    if (roundOp.timerState === 'Ended' && roundOp.roundEndedAwaitingCompletion) {
      // Re-open ended timer only if not Completed yet
      roundOp.endedAt = '';
      roundOp.roundEndedAwaitingCompletion = false;
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const snapBefore = computeTimerSnapshot(roundOp, nowMs);
    const addedSeconds = Math.round(mins * 60);

    // If timer already passed expiry, absorb any post-expiry overshoot so +minutes starts cleanly from right now (or pausedAt if paused).
    if (snapBefore.hasDuration && (snapBefore.isExpired || roundOp.timerState === 'Expired')) {
      const totalBeforeMs = snapBefore.totalDurationSeconds * 1000;
      const startedMsParsed = Date.parse(roundOp.startedAt);
      const startedMs = Number.isNaN(startedMsParsed) ? nowMs : startedMsParsed;
      const refEndMs = (roundOp.roundStatus === 'Paused' && roundOp.pausedAt && !Number.isNaN(Date.parse(roundOp.pausedAt)))
        ? Date.parse(roundOp.pausedAt)
        : nowMs;
      const actualActiveMs = Math.max(0, refEndMs - startedMs - (Number(roundOp.accumulatedPausedMs) || 0));
      const overshootMs = Math.max(0, actualActiveMs - totalBeforeMs);
      roundOp.accumulatedPausedMs = (Number(roundOp.accumulatedPausedMs) || 0) + overshootMs;
      roundOp.endedAt = '';
      roundOp.expiredNoticeLogged = false;
      roundOp.timerState = roundOp.roundStatus === 'Live' ? 'Running' : 'Paused';
    }

    const cleanReason = String(reason || `Manual +${Math.round(mins)}m extension`).trim();
    const actorRef = formatActorRef(actor);
    roundOp.extensionHistory = [
      ...(Array.isArray(roundOp.extensionHistory) ? roundOp.extensionHistory : []),
      {
        id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        addedSeconds,
        reason: cleanReason,
        addedAt: nowIso,
        actorId: actorRef.actorId
      }
    ];

    const snapAfter = computeTimerSnapshot(roundOp, nowMs);
    roundOp.remainingSecondsSnapshot = snapAfter.remainingSeconds;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'timer_extended',
      description: `Extended Round ${round.order} ("${round.name}") timer by +${Math.round(mins)} min(s): ${cleanReason}.`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, {
      title: `Extended Round ${round.order} by +${Math.round(mins)}m`,
      detail: cleanReason
    });
  }

  function updateLiveParticipantStatus(slug, roundId, participantId, nextStatus, actor, nowMsInput) {
    if (!LIVE_PARTICIPATION_STATUSES.includes(nextStatus)) {
      return { ok: false, error: 'Unsupported live participation status.' };
    }
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const round = (current.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const participant = (current.participants || []).find((p) => p.id === participantId);
    if (!participant) return { ok: false, error: 'Participant not found in this event.' };

    const ops = normalizeLiveOps(current.liveOps, current);
    const roundOp = ops.roundsById[round.id];
    const prevStatus = roundOp.participantStatuses[participant.id] || 'Not Started';
    if (prevStatus === nextStatus) return { ok: true, event: current };

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    roundOp.participantStatuses[participant.id] = nextStatus;

    // Also reflect in presentation order if this round tracks participant presentation queue.
    if (Array.isArray(roundOp.presentationOrder)) {
      roundOp.presentationOrder = roundOp.presentationOrder.map((item) => (
        item.kind === 'participant' && item.refId === participant.id ? { ...item, status: nextStatus } : item
      ));
    }

    let activityType = 'participant_status_updated';
    if (nextStatus === 'Absent') activityType = 'participant_absent';
    else if (nextStatus === 'Disqualified') activityType = 'participant_disqualified';

    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType,
      description: `Set participant "${participant.fullName}" to ${nextStatus} in Round ${round.order} ("${round.name}").`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, null);
  }

  function updateLiveTeamStatus(slug, roundId, teamId, nextStatus, actor, nowMsInput) {
    if (!LIVE_PARTICIPATION_STATUSES.includes(nextStatus)) {
      return { ok: false, error: 'Unsupported live team status.' };
    }
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const round = (current.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const team = (current.teams || []).find((t) => t.id === teamId);
    if (!team) return { ok: false, error: 'Team not found in this event.' };

    const ops = normalizeLiveOps(current.liveOps, current);
    const roundOp = ops.roundsById[round.id];
    const prevStatus = roundOp.teamStatuses[team.id] || 'Not Started';
    if (prevStatus === nextStatus) return { ok: true, event: current };

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    roundOp.teamStatuses[team.id] = nextStatus;

    if (Array.isArray(roundOp.presentationOrder)) {
      roundOp.presentationOrder = roundOp.presentationOrder.map((item) => (
        item.kind === 'team' && item.refId === team.id ? { ...item, status: nextStatus } : item
      ));
    }

    let activityType = 'team_status_updated';
    if (nextStatus === 'Absent') activityType = 'team_absent';
    else if (nextStatus === 'Disqualified') activityType = 'team_disqualified';

    ops.operationsUpdatedAt = nowIso;
    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType,
      description: `Set team "${team.teamName || team.name || 'Team'}" to ${nextStatus} in Round ${round.order} ("${round.name}").`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, null);
  }

  function syncPresentationQueue(slug, roundId, orderedEntries, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const round = (current.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const ops = normalizeLiveOps(current.liveOps, current);
    const roundOp = ops.roundsById[round.id];
    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const baseQueue = buildPresentationOrderForRound(current, round, Array.isArray(orderedEntries) ? orderedEntries : roundOp.presentationOrder);
    roundOp.presentationOrder = baseQueue;
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: round.id,
      activityType: 'presentation_order_updated',
      description: `Updated presentation order for Round ${round.order} ("${round.name}", ${baseQueue.length} slot(s)).`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, null);
  }

  function createAnnouncement(slug, payload, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const title = String((payload && payload.title) || '').trim();
    const message = String((payload && payload.message) || '').trim();
    if (!title || !message) {
      return { ok: false, error: 'Announcement title and message are required.' };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const actorRef = formatActorRef(actor);
    const ops = normalizeLiveOps(current.liveOps, current);
    const roundId = payload && payload.roundId ? String(payload.roundId) : '';
    const status = payload && payload.status === 'Published' ? 'Published' : 'Draft';

    const ann = normalizeAnnouncement({
      id: createAnnouncementId(),
      eventId: slug,
      roundId,
      template: (payload && payload.template) || 'Custom Announcement',
      title,
      message,
      status,
      createdAt: nowIso,
      updatedAt: nowIso,
      publishedAt: status === 'Published' ? nowIso : '',
      authorId: actorRef.actorId,
      authorName: actorRef.actorName
    }, slug, ops.announcements.length);

    ops.announcements = [ann, ...ops.announcements];
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: roundId || null,
      activityType: status === 'Published' ? 'announcement_published' : 'announcement_created',
      description: `${status === 'Published' ? 'Created and published' : 'Saved draft'} local announcement "${ann.title}".`,
      timestamp: nowIso,
      actor
    });

    const saved = saveLiveOpsState(slug, ops, null);
    return { ...saved, announcement: ann };
  }

  function updateAnnouncement(slug, announcementId, patch, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const idx = ops.announcements.findIndex((a) => a.id === announcementId);
    if (idx < 0) return { ok: false, error: 'Announcement not found.' };

    const existing = ops.announcements[idx];
    const nextTitle = patch && patch.title != null ? String(patch.title).trim() : existing.title;
    const nextMsg = patch && patch.message != null ? String(patch.message).trim() : existing.message;
    if (!nextTitle || !nextMsg) {
      return { ok: false, error: 'Announcement title and message cannot be empty.' };
    }

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const nextStatus = patch && patch.status === 'Published' ? 'Published' : (patch && patch.status === 'Draft' ? 'Draft' : existing.status);

    const updatedAnn = normalizeAnnouncement({
      ...existing,
      ...patch,
      title: nextTitle,
      message: nextMsg,
      status: nextStatus,
      updatedAt: nowIso,
      publishedAt: nextStatus === 'Published' ? (existing.publishedAt || nowIso) : ''
    }, slug, idx);

    ops.announcements[idx] = updatedAnn;
    ops.operationsUpdatedAt = nowIso;

    const publishedNow = existing.status !== 'Published' && nextStatus === 'Published';
    appendLiveActivity(ops, slug, {
      roundId: updatedAnn.roundId || null,
      activityType: publishedNow ? 'announcement_published' : 'announcement_edited',
      description: publishedNow
        ? `Published local announcement "${updatedAnn.title}".`
        : `Edited local announcement "${updatedAnn.title}".`,
      timestamp: nowIso,
      actor
    });

    const saved = saveLiveOpsState(slug, ops, null);
    return { ...saved, announcement: updatedAnn };
  }

  function publishAnnouncement(slug, announcementId, actor, nowMsInput) {
    return updateAnnouncement(slug, announcementId, { status: 'Published' }, actor, nowMsInput);
  }

  function deleteAnnouncement(slug, announcementId, actor, nowMsInput) {
    const current = getEventBySlug(slug);
    if (!current) return { ok: false, error: 'Event not found.' };
    const ops = normalizeLiveOps(current.liveOps, current);
    const target = ops.announcements.find((a) => a.id === announcementId);
    if (!target) return { ok: false, error: 'Announcement not found.' };

    const nowMs = (typeof nowMsInput === 'number' && Number.isFinite(nowMsInput)) ? nowMsInput : Date.now();
    const nowIso = new Date(nowMs).toISOString();
    ops.announcements = ops.announcements.filter((a) => a.id !== announcementId);
    ops.operationsUpdatedAt = nowIso;

    appendLiveActivity(ops, slug, {
      roundId: target.roundId || null,
      activityType: 'announcement_deleted',
      description: `Deleted local announcement "${target.title}".`,
      timestamp: nowIso,
      actor
    });

    return saveLiveOpsState(slug, ops, null);
  }

  function saveRoundContentState(slug, nextMap, activityInfo) {
    const res = updateEvent(slug, {
      roundContentById: nextMap,
      _skipLog: true
    });
    if (!res.ok) {
      return {
        ok: false,
        event: res.event,
        error: 'Unable to save round content in browser sessionStorage (file or dataset may exceed browser session quota).'
      };
    }
    if (res.event && activityInfo) {
      logActivity(
        'content',
        activityInfo.title || `Updated Round Content on "${res.event.name}"`,
        activityInfo.detail || '',
        slug
      );
    }
    return { ok: true, event: res.event, error: '' };
  }

  function getRoundContentSummary(evOrSlug, roundId) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return null;
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return null;
    const contentMap = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = contentMap[round.id];
    const pdfCount = pkg.pdfs.length;
    const questionCount = pkg.questions.length;
    const problemCount = pkg.codingProblems.length;
    const materialCount = pkg.materials.length;
    const totalItems = pdfCount + questionCount + problemCount + materialCount;
    const avObj = CONTENT_AVAILABILITY_MODES.find((m) => m.key === pkg.availability.mode) || CONTENT_AVAILABILITY_MODES[0];
    return {
      roundId: round.id,
      status: pkg.contentStatus,
      pdfCount,
      questionCount,
      declaredQuestionCount: pkg.declaredQuestionCount,
      effectiveQuestionCount: questionCount > 0 ? questionCount : (pkg.declaredQuestionCount || 0),
      problemCount,
      materialCount,
      totalItems,
      availabilityMode: pkg.availability.mode,
      availabilityLabel: avObj.label,
      updatedAt: pkg.updatedAt
    };
  }

  function getRoundContentPackage(slug, roundId) {
    const ev = getEventBySlug(slug);
    if (!ev) return null;
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return null;
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    return map[round.id] || null;
  }

  function syncPkgStatusAfterMutation(pkg) {
    const hasItems = pkg.pdfs.length > 0
      || (Array.isArray(pkg.attachments) && pkg.attachments.length > 0)
      || pkg.questions.length > 0
      || pkg.codingProblems.length > 0
      || pkg.materials.length > 0
      || Boolean(pkg.paperTitle || pkg.description || pkg.instructions || (pkg.challengeSpec && pkg.challengeSpec.taskDescription));
    if (!hasItems && pkg.contentStatus !== 'Archived') {
      pkg.contentStatus = 'No Content';
    } else if (hasItems && pkg.contentStatus === 'No Content') {
      pkg.contentStatus = 'Draft';
    }
    pkg.updatedAt = new Date().toISOString();
    return pkg;
  }

  function saveRoundContentMeta(slug, roundId, patch) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Configured round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const prev = map[round.id];
    const p = patch && typeof patch === 'object' ? patch : {};
    const nextPkg = normalizeRoundContentPackage({
      ...prev,
      ...p,
      availability: p.availability && typeof p.availability === 'object'
        ? { ...prev.availability, ...p.availability }
        : prev.availability,
      updatedAt: new Date().toISOString()
    }, round, slug);

    if (p.contentStatus && CONTENT_STATUSES.includes(p.contentStatus)) {
      nextPkg.contentStatus = p.contentStatus;
    } else {
      syncPkgStatusAfterMutation(nextPkg);
    }

    map[round.id] = nextPkg;
    return saveRoundContentState(slug, map, {
      title: `Updated "${round.name}" content settings`,
      detail: `Status: ${nextPkg.contentStatus} • ${nextPkg.pdfs.length} PDF(s), ${nextPkg.questions.length} question(s)`
    });
  }

  function addRoundPdf(slug, roundId, pdfMeta) {
    const check = validatePdfDescriptor(pdfMeta);
    if (!check.ok) return { ok: false, error: check.error };
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const newPdf = normalizeRoundPdf({
      ...pdfMeta,
      id: createContentItemId('pdf'),
      fileName: check.fileName,
      mimeType: check.mimeType,
      sizeBytes: check.sizeBytes,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, round, pkg.pdfs.length);

    pkg.pdfs.push(newPdf);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Uploaded PDF "${newPdf.title}" to Round ${round.order}`,
      detail: `${newPdf.category} • ${(check.sizeBytes / 1024).toFixed(1)} KB`
    });
    return { ...saved, pdf: newPdf };
  }

  function replaceRoundPdf(slug, roundId, pdfId, pdfMeta) {
    const check = validatePdfDescriptor(pdfMeta);
    if (!check.ok) return { ok: false, error: check.error };
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const idx = pkg.pdfs.findIndex((p) => p.id === pdfId);
    if (idx < 0) return { ok: false, error: 'Target PDF document not found.' };

    const updated = normalizeRoundPdf({
      ...pkg.pdfs[idx],
      fileId: pdfMeta.fileId != null ? String(pdfMeta.fileId) : '',
      fileName: check.fileName,
      mimeType: check.mimeType,
      sizeBytes: check.sizeBytes,
      dataUrl: typeof pdfMeta.dataUrl === 'string' ? pdfMeta.dataUrl : (pdfMeta.fileId ? '' : pkg.pdfs[idx].dataUrl),
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, round, idx);
    pkg.pdfs[idx] = updated;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Replaced PDF file for "${updated.title}"`,
      detail: `Round ${round.order} • ${updated.fileName}`
    });
    return { ...saved, pdf: updated };
  }

  function updateRoundPdfMeta(slug, roundId, pdfId, patch) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const idx = pkg.pdfs.findIndex((p) => p.id === pdfId);
    if (idx < 0) return { ok: false, error: 'PDF document not found.' };

    const updated = normalizeRoundPdf({
      ...pkg.pdfs[idx],
      ...(patch || {}),
      id: pkg.pdfs[idx].id,
      fileName: pkg.pdfs[idx].fileName,
      sizeBytes: pkg.pdfs[idx].sizeBytes,
      dataUrl: pkg.pdfs[idx].dataUrl,
      updatedAt: new Date().toISOString()
    }, round, idx);
    pkg.pdfs[idx] = updated;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, null);
    return { ...saved, pdf: updated };
  }

  function removeRoundPdf(slug, roundId, pdfId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const target = pkg.pdfs.find((p) => p.id === pdfId);
    if (!target) return { ok: false, error: 'PDF document not found.' };

    pkg.pdfs = pkg.pdfs.filter((p) => p.id !== pdfId);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, {
      title: `Removed PDF "${target.title}"`,
      detail: `Round ${round.order}`
    });
  }

  function addRoundQuestion(slug, roundId, questionData) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const prompt = String((questionData && (questionData.prompt || questionData.question)) || '').trim();
    if (!prompt) return { ok: false, error: 'Question prompt text is required.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const q = normalizeRoundQuestion({
      ...questionData,
      id: createContentItemId('qst'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, pkg.questions.length);

    pkg.questions.push(q);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Added question #${pkg.questions.length} to Round ${round.order}`,
      detail: `${q.questionType.toUpperCase()} • ${q.marks} mark(s)`
    });
    return { ...saved, question: q };
  }

  function updateRoundQuestion(slug, roundId, questionId, patch) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const idx = pkg.questions.findIndex((q) => q.id === questionId);
    if (idx < 0) return { ok: false, error: 'Question not found.' };

    const merged = normalizeRoundQuestion({
      ...pkg.questions[idx],
      ...(patch || {}),
      id: pkg.questions[idx].id,
      updatedAt: new Date().toISOString()
    }, idx);
    if (!merged.prompt) return { ok: false, error: 'Question prompt cannot be empty.' };
    pkg.questions[idx] = merged;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, null);
    return { ...saved, question: merged };
  }

  function duplicateRoundQuestion(slug, roundId, questionId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const srcIdx = pkg.questions.findIndex((q) => q.id === questionId);
    if (srcIdx < 0) return { ok: false, error: 'Question not found.' };

    const cloneQ = normalizeRoundQuestion({
      ...JSON.parse(JSON.stringify(pkg.questions[srcIdx])),
      id: createContentItemId('qst'),
      prompt: `${pkg.questions[srcIdx].prompt} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, pkg.questions.length);

    pkg.questions.splice(srcIdx + 1, 0, cloneQ);
    pkg.questions = pkg.questions.map((q, idx) => ({ ...q, order: idx + 1 }));
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, null);
    return { ...saved, question: cloneQ };
  }

  function deleteRoundQuestion(slug, roundId, questionId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const nextList = pkg.questions.filter((q) => q.id !== questionId).map((q, idx) => ({ ...q, order: idx + 1 }));
    if (nextList.length === pkg.questions.length) return { ok: false, error: 'Question not found.' };
    pkg.questions = nextList;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, {
      title: `Removed question from Round ${round.order}`,
      detail: `${pkg.questions.length} question(s) remaining`
    });
  }

  function reorderRoundQuestions(slug, roundId, orderedIds) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const byId = new Map(pkg.questions.map((q) => [q.id, q]));
    const reordered = [];
    (Array.isArray(orderedIds) ? orderedIds : []).forEach((id) => {
      if (byId.has(id)) {
        reordered.push(byId.get(id));
        byId.delete(id);
      }
    });
    byId.forEach((leftover) => reordered.push(leftover));
    pkg.questions = reordered.map((q, idx) => ({ ...q, order: idx + 1 }));
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, null);
  }

  function parseCsvRow(line) {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  function buildSampleQuestionsCsv() {
    const rows = [
      ['question_type', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'marks', 'negative_marks', 'mandatory', 'explanation'],
      ['mcq', 'Which HTTP method replaces an entire target resource idempotently?', 'POST', 'PUT', 'PATCH', 'CONNECT', 'B', '2', '0.5', 'true', 'PUT replaces the representation at the target URI cleanly.'],
      ['mcq_multi', 'Which of the following structures have O(1) average lookup?', 'Hash Table', 'Binary Search Tree', 'JavaScript Set', 'Sorted Array', 'A;C', '4', '1', 'true', 'Hash Table and Set use hashing for O(1) expected lookups.'],
      ['true_false', 'TLS encrypts data in transit between client and HTTPS server.', 'True', 'False', '', '', 'A', '1', '0', 'true', 'TLS provides transport encryption for HTTPS.']
    ];
    return rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  }

  function parseCorrectAnswerTokens(rawCorrect, qType, optCount) {
    const letterMap = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
    const clean = String(rawCorrect || '').trim();
    if (!clean) return { ok: false, error: 'Missing correct answer.' };

    const tokens = clean.split(/[;|/]+/).map((t) => t.trim()).filter(Boolean);
    const indices = [];
    for (const tok of tokens) {
      const low = tok.toLowerCase();
      let idx = -1;
      if (low === 'true' && qType === 'true_false') idx = 0;
      else if (low === 'false' && qType === 'true_false') idx = 1;
      else if (Object.prototype.hasOwnProperty.call(letterMap, low)) idx = letterMap[low];
      else if (/^\d+$/.test(low)) idx = parseInt(low, 10) - 1;
      if (idx < 0 || idx >= optCount) {
        return { ok: false, error: `Invalid correct answer "${tok}" for ${optCount} options.` };
      }
      if (!indices.includes(idx)) indices.push(idx);
    }
    if (!indices.length) return { ok: false, error: 'No valid answer index specified.' };
    return { ok: true, indices: indices.sort((a, b) => a - b) };
  }

  function parseQuestionImportText(rawInput, existingQuestions) {
    const existingSet = new Set(
      (Array.isArray(existingQuestions) ? existingQuestions : [])
        .map((q) => String((q && q.prompt) || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const seenBatch = new Set();
    const valid = [];
    const errors = [];

    function pushValidated(rowData, label) {
      const prompt = String((rowData && (rowData.prompt || rowData.question)) || '').trim();
      if (!prompt) {
        errors.push(`${label}: missing question prompt.`);
        return;
      }
      const key = prompt.toLowerCase();
      if (existingSet.has(key) || seenBatch.has(key)) {
        errors.push(`${label}: duplicate question "${prompt.slice(0, 48)}".`);
        return;
      }
      const qType = QUESTION_TYPES.some((t) => t.key === rowData.questionType) ? rowData.questionType : 'mcq';
      const marksNum = Number(rowData.marks);
      if (rowData.marks !== '' && rowData.marks != null && (!Number.isFinite(marksNum) || marksNum <= 0)) {
        errors.push(`${label}: invalid marks "${rowData.marks}" (must be > 0).`);
        return;
      }
      const opts = qType === 'true_false'
        ? ['True', 'False']
        : (Array.isArray(rowData.options) ? rowData.options.map((x) => String(x || '').trim()).filter(Boolean) : []);
      if (qType !== 'short_answer' && opts.length < 2) {
        errors.push(`${label}: missing answer options (minimum 2 required).`);
        return;
      }

      seenBatch.add(key);
      valid.push(normalizeRoundQuestion({
        ...rowData,
        questionType: qType,
        prompt,
        options: opts,
        marks: Number.isFinite(marksNum) && marksNum > 0 ? marksNum : 1
      }, valid.length));
    }

    if (Array.isArray(rawInput)) {
      rawInput.forEach((row, idx) => pushValidated(row, `Row ${idx + 1}`));
      return { ok: valid.length > 0, valid, errors, totalRows: rawInput.length };
    }

    const text = String(rawInput || '').trim();
    if (!text) return { ok: false, valid: [], errors: ['Upload or paste a CSV, pipe-delimited, or JSON question set.'], totalRows: 0 };

    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : []);
        return parseQuestionImportText(arr, existingQuestions);
      } catch (err) {
        return { ok: false, valid: [], errors: ['Invalid JSON syntax: ' + err.message], totalRows: 0 };
      }
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (!lines.length) return { ok: false, valid: [], errors: ['No rows found in CSV/text input.'], totalRows: 0 };

    const isPipeMode = lines[0].includes('|') && !lines[0].includes(',');
    let startIdx = 0;
    let hasTypedCsvHeader = false;
    if (!isPipeMode) {
      const headerCols = parseCsvRow(lines[0]).map((c) => c.toLowerCase());
      if (headerCols.includes('prompt') || headerCols.includes('question')) {
        startIdx = 1;
        hasTypedCsvHeader = headerCols[0] === 'question_type' || headerCols[0] === 'type';
      }
    }

    for (let idx = startIdx; idx < lines.length; idx += 1) {
      const lineNum = idx + 1;
      const line = lines[idx];
      if (isPipeMode) {
        const cols = line.split('|').map((c) => c.trim());
        if (cols.length < 3) {
          errors.push(`Line ${lineNum}: expected "Prompt | Opt A | Opt B | [Opt C | Opt D] | Correct | Marks".`);
          continue;
        }
        const prompt = cols[0];
        const opts = cols.length >= 6 ? cols.slice(1, 5).filter(Boolean) : cols.slice(1, cols.length - 1).filter(Boolean);
        const correctRaw = cols.length >= 6 ? cols[5] : cols[cols.length - 1];
        const marksRaw = cols.length >= 7 ? cols[6] : '1';
        const diffRaw = cols.length >= 8 ? cols[7] : 'Medium';
        const parsedAns = parseCorrectAnswerTokens(correctRaw, 'mcq', opts.length);
        if (!parsedAns.ok) {
          errors.push(`Line ${lineNum}: ${parsedAns.error}`);
          continue;
        }
        pushValidated({
          questionType: parsedAns.indices.length > 1 ? 'mcq_multi' : 'mcq',
          prompt,
          options: opts,
          correctOptionIndex: parsedAns.indices[0],
          correctOptionIndices: parsedAns.indices,
          marks: marksRaw,
          difficulty: DIFFICULTY_LEVELS.includes(diffRaw) ? diffRaw : 'Medium'
        }, `Line ${lineNum}`);
      } else {
        const cols = parseCsvRow(line);
        // CSV format: [question_type], prompt, opt_a, opt_b, opt_c, opt_d, correct_answer, [marks], [negative_marks], [mandatory], [explanation]
        const lookTyped = hasTypedCsvHeader || QUESTION_TYPES.some((t) => t.key === String(cols[0] || '').trim().toLowerCase());
        const offset = lookTyped ? 1 : 0;
        if (cols.length < offset + 4) {
          errors.push(`Row ${lineNum}: insufficient CSV columns (need prompt, options, and correct answer).`);
          continue;
        }
        const qTypeRaw = lookTyped ? String(cols[0] || 'mcq').trim().toLowerCase() : 'mcq';
        const qType = QUESTION_TYPES.some((t) => t.key === qTypeRaw) ? qTypeRaw : 'mcq';
        const prompt = cols[offset];
        const opts = qType === 'true_false'
          ? ['True', 'False']
          : cols.slice(offset + 1, offset + 5).filter(Boolean);
        const correctRaw = cols[offset + 5] != null ? cols[offset + 5] : cols[cols.length - 1];
        const marksRaw = cols[offset + 6] != null && cols[offset + 6] !== '' ? cols[offset + 6] : '1';
        const negRaw = cols[offset + 7] != null && cols[offset + 7] !== '' ? cols[offset + 7] : '0';
        const mandRaw = String(cols[offset + 8] || 'true').trim().toLowerCase();
        const expRaw = cols[offset + 9] || '';

        const parsedAns = qType === 'short_answer'
          ? (String(correctRaw || '').trim() ? { ok: true, text: String(correctRaw).trim() } : { ok: false, error: 'Missing expected answer.' })
          : parseCorrectAnswerTokens(correctRaw, qType, opts.length);
        if (!parsedAns.ok) {
          errors.push(`Row ${lineNum}: ${parsedAns.error}`);
          continue;
        }
        if (qType === 'mcq_multi' && parsedAns.indices.length < 1) {
          errors.push(`Row ${lineNum}: select at least one correct option.`);
          continue;
        }

        pushValidated({
          questionType: qType,
          prompt,
          options: opts,
          correctOptionIndex: parsedAns.indices ? parsedAns.indices[0] : 0,
          correctOptionIndices: parsedAns.indices || [],
          acceptedAnswer: parsedAns.text || '',
          marks: marksRaw,
          negativeMarks: Number(negRaw) || 0,
          mandatory: mandRaw !== 'false' && mandRaw !== '0' && mandRaw !== 'no',
          explanation: expRaw
        }, `Row ${lineNum}`);
      }
    }

    return { ok: valid.length > 0, valid, errors, totalRows: Math.max(0, lines.length - startIdx) };
  }

  function importRoundQuestions(slug, roundId, rawInput) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, importedCount: 0, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, importedCount: 0, error: 'Round not found.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const parsed = parseQuestionImportText(rawInput, pkg.questions);
    if (!parsed.valid.length) {
      return { ok: false, importedCount: 0, errors: parsed.errors, error: parsed.errors[0] || 'No valid questions found to import.' };
    }

    const startOrder = pkg.questions.length;
    parsed.valid.forEach((q, idx) => {
      pkg.questions.push({
        ...q,
        id: createContentItemId('qst'),
        order: startOrder + idx + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Imported ${parsed.valid.length} question(s) to Round ${round.order}`,
      detail: parsed.errors.length ? `${parsed.errors.length} skipped row(s)` : 'Clean import'
    });
    return { ...saved, importedCount: parsed.valid.length, errors: parsed.errors };
  }

  function addCodingProblem(slug, roundId, problemData) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const title = String((problemData && (problemData.problemTitle || problemData.title)) || '').trim();
    if (!title) return { ok: false, error: 'Problem or task title is required.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const prob = normalizeCodingProblem({
      ...problemData,
      problemTitle: title,
      id: createContentItemId('prb'),
      updatedAt: new Date().toISOString()
    }, pkg.codingProblems.length);

    pkg.codingProblems.push(prob);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Added problem "${prob.problemTitle}" to Round ${round.order}`,
      detail: `${prob.difficulty} • ${prob.points} pts`
    });
    return { ...saved, problem: prob };
  }

  function updateCodingProblem(slug, roundId, problemId, patch) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const idx = pkg.codingProblems.findIndex((p) => p.id === problemId);
    if (idx < 0) return { ok: false, error: 'Problem not found.' };

    const updated = normalizeCodingProblem({
      ...pkg.codingProblems[idx],
      ...(patch || {}),
      id: pkg.codingProblems[idx].id,
      updatedAt: new Date().toISOString()
    }, idx);
    if (!updated.problemTitle) return { ok: false, error: 'Problem title cannot be empty.' };
    pkg.codingProblems[idx] = updated;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, null);
    return { ...saved, problem: updated };
  }

  function deleteCodingProblem(slug, roundId, problemId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const next = pkg.codingProblems.filter((p) => p.id !== problemId).map((p, idx) => ({ ...p, order: idx + 1 }));
    if (next.length === pkg.codingProblems.length) return { ok: false, error: 'Problem not found.' };
    pkg.codingProblems = next;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, {
      title: `Removed problem from Round ${round.order}`,
      detail: `${pkg.codingProblems.length} problem(s) left`
    });
  }

  function duplicateCodingProblem(slug, roundId, problemId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const srcIdx = pkg.codingProblems.findIndex((p) => p.id === problemId);
    if (srcIdx < 0) return { ok: false, error: 'Problem not found.' };

    const cloned = normalizeCodingProblem({
      ...JSON.parse(JSON.stringify(pkg.codingProblems[srcIdx])),
      id: createContentItemId('prb'),
      problemTitle: `${pkg.codingProblems[srcIdx].problemTitle} (Copy)`,
      updatedAt: new Date().toISOString()
    }, pkg.codingProblems.length);

    pkg.codingProblems.splice(srcIdx + 1, 0, cloned);
    pkg.codingProblems = pkg.codingProblems.map((p, idx) => ({ ...p, order: idx + 1 }));
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, null);
    return { ...saved, problem: cloned };
  }

  function reorderCodingProblems(slug, roundId, orderedIds) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const byId = new Map(pkg.codingProblems.map((p) => [p.id, p]));
    const reordered = [];
    (Array.isArray(orderedIds) ? orderedIds : []).forEach((id) => {
      if (byId.has(id)) {
        reordered.push(byId.get(id));
        byId.delete(id);
      }
    });
    byId.forEach((leftover) => reordered.push(leftover));
    pkg.codingProblems = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, null);
  }

  function addRoundAttachment(slug, roundId, attMeta) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const size = Number(attMeta && attMeta.sizeBytes);
    if (size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `Attachment exceeds 25 MB limit.` };
    }
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const att = normalizeRoundAttachment({
      ...(attMeta || {}),
      id: createContentItemId('att'),
      uploadedAt: new Date().toISOString()
    }, pkg.attachments.length);
    pkg.attachments.push(att);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Attached "${att.title}" to Round ${round.order}`,
      detail: att.category
    });
    return { ...saved, attachment: att };
  }

  function removeRoundAttachment(slug, roundId, attId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const next = pkg.attachments.filter((a) => a.id !== attId);
    if (next.length === pkg.attachments.length) return { ok: false, error: 'Attachment not found.' };
    pkg.attachments = next;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, null);
  }

  function addRoundMaterial(slug, roundId, matData) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const title = String((matData && matData.title) || '').trim();
    if (!title) return { ok: false, error: 'Material title is required.' };

    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const mat = normalizeRoundMaterial({
      ...matData,
      id: createContentItemId('mat'),
      updatedAt: new Date().toISOString()
    }, pkg.materials.length);
    pkg.materials.push(mat);
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    const saved = saveRoundContentState(slug, map, {
      title: `Added material "${mat.title}" to Round ${round.order}`,
      detail: mat.category
    });
    return { ...saved, material: mat };
  }

  function deleteRoundMaterial(slug, roundId, materialId) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[round.id];
    const next = pkg.materials.filter((m) => m.id !== materialId);
    if (next.length === pkg.materials.length) return { ok: false, error: 'Material item not found.' };
    pkg.materials = next;
    syncPkgStatusAfterMutation(pkg);
    map[round.id] = pkg;
    return saveRoundContentState(slug, map, null);
  }

  function evaluateRoundContentAccess(evOrSlug, roundId, user, nowMsInput) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return { allowed: false, state: 'not_found', reason: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round || round.enabled === false || round.status === 'Disabled') {
      return { allowed: false, state: 'disabled', reason: 'Round is not active or configured.' };
    }
    if (ev.statusKey === 'cancelled') {
      return { allowed: false, state: 'cancelled', reason: 'Event has been cancelled.' };
    }

    const contentMap = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = contentMap[round.id];
    if (!pkg || pkg.contentStatus !== 'Published') {
      return {
        allowed: false,
        state: 'unpublished',
        reason: pkg && pkg.contentStatus === 'Archived'
          ? 'Round materials have been archived by the organizer.'
          : 'Round materials and question papers are not published yet.'
      };
    }

    const av = pkg.availability || { mode: 'locked' };
    if (av.mode === 'locked') {
      return {
        allowed: false,
        state: 'locked',
        reason: 'Materials are locked by the organizer prior to release.'
      };
    }

    if (!user || (!user.email && !user.id)) {
      return { allowed: false, state: 'auth_required', reason: 'Sign in with a registered participant account to unlock round materials.' };
    }

    const reg = findExistingUserParticipant(ev, user);
    if (!reg || reg.registrationStatus === 'Cancelled' || reg.registrationStatus === 'Rejected') {
      return { allowed: false, state: 'not_registered', reason: 'An active event registration is required to view round materials.' };
    }
    if (av.requireApprovedRegistration !== false && reg.registrationStatus !== 'Approved') {
      return { allowed: false, state: 'approval_pending', reason: `Registration status is ${reg.registrationStatus}. Organizer approval is required before release.` };
    }

    const liveOps = normalizeLiveOps(ev.liveOps, ev);
    const roundOp = liveOps.roundsById[round.id];
    if (roundOp && roundOp.participantStatuses && roundOp.participantStatuses[reg.id] === 'Disqualified') {
      return { allowed: false, state: 'disqualified', reason: 'Access restricted due to Disqualified status in this round.' };
    }

    const nowMs = typeof nowMsInput === 'number' && Number.isFinite(nowMsInput) ? nowMsInput : Date.now();
    const pausedPolicy = av.pausedAccessPolicy === 'allow' ? 'allow' : 'restrict';
    const completedPolicy = av.completedAccessPolicy === 'restrict' ? 'restrict' : 'allow';

    if (av.mode === 'on_round_start') {
      if (!roundOp || roundOp.roundStatus === 'Upcoming') {
        return { allowed: false, state: 'awaiting_live', reason: 'Locked until the organizer starts this round in Live Control.' };
      }
      if (roundOp.roundStatus === 'Paused' && pausedPolicy === 'restrict') {
        return { allowed: false, state: 'round_paused', reason: 'Temporarily restricted while this round is Paused.' };
      }
      if (roundOp.roundStatus === 'Completed' && completedPolicy === 'restrict') {
        return { allowed: false, state: 'round_completed', reason: 'Materials closed after round completion.' };
      }
    } else if (av.mode === 'live_only') {
      if (!roundOp || roundOp.roundStatus !== 'Live') {
        return { allowed: false, state: 'awaiting_live', reason: 'Available exclusively while this round is actively Live.' };
      }
    } else if (av.mode === 'scheduled') {
      const roundActiveOrDone = roundOp && (roundOp.roundStatus === 'Live' || roundOp.roundStatus === 'Completed');
      const releaseMs = av.releaseAt ? Date.parse(av.releaseAt) : NaN;
      const schedMs = round.startDateTime ? Date.parse(round.startDateTime) : NaN;
      const targetMs = !Number.isNaN(releaseMs) ? releaseMs : schedMs;
      if (!roundActiveOrDone) {
        if (Number.isNaN(targetMs) || nowMs < targetMs) {
          return {
            allowed: false,
            state: 'scheduled_locked',
            reason: Number.isNaN(targetMs)
              ? 'Scheduled release activates when the organizer starts this round.'
              : `Scheduled release opens ${new Date(targetMs).toLocaleString()}.`
          };
        }
      }
      if (roundOp && roundOp.roundStatus === 'Paused' && pausedPolicy === 'restrict') {
        return { allowed: false, state: 'round_paused', reason: 'Temporarily restricted while this round is Paused.' };
      }
      if (roundOp && roundOp.roundStatus === 'Completed' && completedPolicy === 'restrict') {
        return { allowed: false, state: 'round_completed', reason: 'Materials closed after round completion.' };
      }
    } else if (av.mode === 'registered_immediately') {
      if (roundOp && roundOp.roundStatus === 'Paused' && pausedPolicy === 'restrict') {
        return { allowed: false, state: 'round_paused', reason: 'Temporarily restricted while this round is Paused.' };
      }
      if (roundOp && roundOp.roundStatus === 'Completed' && completedPolicy === 'restrict') {
        return { allowed: false, state: 'round_completed', reason: 'Materials closed after round completion.' };
      }
    }

    return { allowed: true, state: 'unlocked', reason: 'Eligible participant access granted.', registration: reg };
  }

  function sanitizePackageForParticipant(pkg) {
    const av = pkg.availability || {};
    const allowPdfDownload = av.allowPdfDownload !== false;
    const allowAttachmentDownload = av.allowAttachmentDownload !== false;

    return {
      roundId: pkg.roundId,
      eventId: pkg.eventId,
      paperTitle: pkg.paperTitle,
      description: pkg.description,
      instructions: pkg.instructions,
      totalMarks: pkg.totalMarks,
      durationLabel: pkg.durationLabel,
      declaredQuestionCount: pkg.declaredQuestionCount,
      allowPdfDownload,
      allowAttachmentDownload,
      challengeSpec: pkg.challengeSpec ? { ...pkg.challengeSpec } : {},
      pdfs: pkg.pdfs.map((p) => ({
        id: p.id,
        fileId: p.fileId || '',
        storagePath: p.storagePath || '',
        category: p.category,
        title: p.title,
        fileName: p.fileName,
        sizeBytes: p.sizeBytes,
        uploadedAt: p.uploadedAt,
        dataUrl: p.dataUrl || '',
        allowDownload: allowPdfDownload,
        description: p.description,
        instructions: p.instructions,
        totalMarks: p.totalMarks,
        duration: p.duration,
        questionCount: p.questionCount
      })),
      attachments: (pkg.attachments || [])
        .filter((a) => a.visibility !== 'organizer_only')
        .map((a) => ({
          id: a.id,
          fileId: a.fileId || '',
          storagePath: a.storagePath || '',
          category: a.category,
          title: a.title,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          dataUrl: a.dataUrl || '',
          allowDownload: allowAttachmentDownload,
          description: a.description
        })),
      questions: pkg.questions.map((q) => ({
        id: q.id,
        order: q.order,
        questionType: q.questionType,
        prompt: q.prompt,
        codeSnippet: q.codeSnippet,
        options: [...q.options],
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        mandatory: q.mandatory !== false,
        imageFileId: q.imageFileId || '',
        imageName: q.imageName || '',
        imageDataUrl: q.imageDataUrl || '',
        difficulty: q.difficulty,
        tags: [...q.tags]
        // Strictly omit correctOptionIndex, correctOptionIndices, acceptedAnswer, and answer explanation
      })),
      codingProblems: pkg.codingProblems.map((prob) => ({
        id: prob.id,
        order: prob.order,
        problemTitle: prob.problemTitle,
        difficulty: prob.difficulty,
        points: prob.points,
        timeLimit: prob.timeLimit || '2 Seconds',
        statement: prob.statement,
        inputFormat: prob.inputFormat,
        outputFormat: prob.outputFormat,
        constraints: prob.constraints,
        sampleInput: prob.sampleInput,
        sampleOutput: prob.sampleOutput,
        explanation: prob.explanation || '',
        submissionInstructions: prob.submissionInstructions || '',
        problemPdfFileId: prob.problemPdfFileId || '',
        problemPdfName: prob.problemPdfName || '',
        allowDownload: allowPdfDownload,
        attachments: (prob.attachments || []).map((a) => ({ ...a, allowDownload: allowAttachmentDownload })),
        allowedLanguages: [...prob.allowedLanguages],
        starterUrl: prob.starterUrl,
        assetsNote: prob.assetsNote
      })),
      materials: pkg.materials
        .filter((m) => m.visibility !== 'organizer_only')
        .map((m) => ({
          id: m.id,
          category: m.category,
          title: m.title,
          description: m.description,
          resourceUrl: m.resourceUrl
        }))
    };
  }

  function getParticipantRoundContent(slug, roundId, user, nowMsInput) {
    const ev = getEventBySlug(slug);
    if (!ev) return { allowed: false, state: 'not_found', reason: 'Event not found.', content: null };
    const gate = evaluateRoundContentAccess(ev, roundId, user, nowMsInput);
    if (!gate.allowed) {
      return { ...gate, content: null };
    }
    const map = normalizeEventRoundContent(ev.roundContentById, ev);
    const pkg = map[roundId];
    return {
      ...gate,
      content: pkg ? sanitizePackageForParticipant(pkg) : null
    };
  }

  function getParticipantRoundPortalSnapshot(slug, roundId, user, nowMsInput) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };
    const reg = user ? findExistingUserParticipant(ev, user) : null;
    const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
    const targetKey = reg
      ? (useTeams && reg.teamId ? buildTargetKey('team', reg.teamId) : buildTargetKey('participant', reg.id))
      : '';

    const liveSnap = getLiveOperationsSnapshot(slug, nowMsInput);
    const roundOp = liveSnap && liveSnap.liveOps.roundsById[round.id];
    const timerSnapshot = liveSnap && liveSnap.timersByRoundId[round.id];
    const access = getParticipantRoundContent(slug, round.id, user, nowMsInput);

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[round.id];
    const mySub = targetKey && rEval && rEval.submissionsByTarget[targetKey] ? rEval.submissionsByTarget[targetKey] : null;
    const myEvalRec = targetKey && rEval && rEval.scoresByTarget[targetKey] ? rEval.scoresByTarget[targetKey] : null;

    let submissionStatus = 'Not Submitted';
    if (mySub) {
      if (myEvalRec && (myEvalRec.evaluationStatus === 'Evaluated' || myEvalRec.evaluationStatus === 'Approved' || myEvalRec.evaluationStatus === 'Rejected')) {
        submissionStatus = rEval.publication.roundPublished ? 'Evaluated' : 'Submitted';
      } else if (myEvalRec && myEvalRec.evaluationStatus === 'Under Review') {
        submissionStatus = 'Under Evaluation';
      } else {
        submissionStatus = 'Submitted';
      }
    }

    const publishedEvaluation = rEval && rEval.publication.roundPublished && myEvalRec
      ? {
          awardedMarks: myEvalRec.awardedMarks,
          maxMarks: myEvalRec.maxMarks,
          percentage: myEvalRec.percentage,
          publicFeedback: rEval.publication.showPublicFeedback ? myEvalRec.publicFeedback : ''
        }
      : null;

    return {
      ok: true,
      event: ev,
      round,
      roundOp,
      timerSnapshot,
      targetKey,
      access,
      mySubmission: mySub,
      submissionStatus,
      publishedEvaluation
    };
  }

  function saveEvaluationState(slug, nextEvalState, activityInfo) {
    const res = updateEvent(slug, {
      evaluationState: nextEvalState,
      _skipLog: true
    });
    if (!res.ok) {
      return {
        ok: false,
        event: res.event,
        error: 'Unable to persist evaluation state in browser sessionStorage.'
      };
    }
    if (res.event && activityInfo) {
      logActivity(
        'evaluation',
        activityInfo.title || `Updated evaluations on "${res.event.name}"`,
        activityInfo.detail || '',
        slug
      );
    }
    return { ok: true, event: res.event, error: '' };
  }

  function resolveRoundTargets(ev, roundId) {
    const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
    const activeParts = (ev.participants || []).filter((p) => p.registrationStatus !== 'Cancelled' && p.registrationStatus !== 'Rejected');
    const regById = new Map(activeParts.map((p) => [p.id, p]));
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const liveOps = normalizeLiveOps(ev.liveOps, ev);

    // Check if any earlier round progressed qualifiers directly into this round
    const earlierProgressedSet = new Set();
    let hasProgressedUpstream = false;
    (ev.rounds || []).forEach((r) => {
      if (r.id === roundId) return;
      const re = evalState.roundEvalsById[r.id];
      if (re && re.qualification && re.qualification.targetNextRoundId === roundId && re.qualification.progressedKeys.length > 0) {
        hasProgressedUpstream = true;
        re.qualification.progressedKeys.forEach((k) => earlierProgressedSet.add(k));
      }
    });

    const curEval = evalState.roundEvalsById[roundId];
    const curLive = liveOps.roundsById[roundId];

    let allTargets = [];
    if (useTeams) {
      allTargets = (ev.teams || []).map((t) => {
        const key = buildTargetKey('team', t.id);
        const leader = t.teamLeaderId ? regById.get(t.teamLeaderId) : null;
        return {
          targetKey: key,
          targetKind: 'team',
          targetId: t.id,
          displayId: t.id,
          name: t.teamName || t.name || 'Team',
          secondaryLabel: `${(t.memberIds || []).length} member(s)${leader ? ` • Lead: ${leader.fullName}` : ''}`,
          registrationStatus: t.status || 'Active',
          liveStatus: (curLive && curLive.teamStatuses && curLive.teamStatuses[t.id]) || 'Not Started'
        };
      });
    } else {
      allTargets = activeParts.map((p) => {
        const key = buildTargetKey('participant', p.id);
        return {
          targetKey: key,
          targetKind: 'participant',
          targetId: p.id,
          displayId: p.registrationId || p.id,
          name: p.fullName,
          secondaryLabel: p.email || (p.metadata && p.metadata.institution) || 'Individual',
          registrationStatus: p.registrationStatus,
          liveStatus: (curLive && curLive.participantStatuses && curLive.participantStatuses[p.id]) || 'Not Started'
        };
      });
    }

    if (hasProgressedUpstream) {
      allTargets = allTargets.filter((t) => {
        if (earlierProgressedSet.has(t.targetKey)) return true;
        if (curEval && curEval.scoresByTarget && curEval.scoresByTarget[t.targetKey]) return true;
        if (curEval && curEval.submissionsByTarget && curEval.submissionsByTarget[t.targetKey]) return true;
        return false;
      });
    }

    return allTargets;
  }

  function recordRoundSubmission(slug, roundId, targetKey, payload, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Configured round not found.' };

    const validTargets = resolveRoundTargets(ev, roundId);
    const targetObj = validTargets.find((t) => t.targetKey === targetKey);
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Evaluation state missing for round.' };

    const parts = String(targetKey || '').split(':');
    const kind = parts[0] === 'team' ? 'team' : 'participant';
    const tid = parts.slice(1).join(':');
    const validOnEvent = kind === 'team'
      ? (ev.teams || []).some((t) => t.id === tid)
      : (ev.participants || []).some((p) => p.id === tid);
    if (!validOnEvent && !targetObj) {
      return { ok: false, error: 'Target participant or team not found in this event.' };
    }

    const nowIso = (payload && payload.submittedAt) || new Date().toISOString();
    const prev = rEval.submissionsByTarget[targetKey];
    const nextHist = prev ? [...prev.submissionHistory] : [];
    nextHist.unshift({
      id: createContentItemId('subh'),
      submittedAt: nowIso,
      note: String((payload && payload.historyNote) || `Recorded ${(payload && payload.submissionType) || round.typeKey} submission`).trim(),
      selectedLanguage: String((payload && payload.selectedLanguage) || '').trim()
    });

    const nextSub = normalizeRoundSubmission({
      ...(prev || {}),
      ...(payload || {}),
      targetKey,
      targetKind: kind,
      targetId: tid,
      submissionType: (payload && payload.submissionType) || round.typeKey,
      submittedAt: nowIso,
      updatedAt: new Date().toISOString(),
      submissionHistory: nextHist.slice(0, 20)
    }, targetKey);

    rEval.submissionsByTarget[targetKey] = nextSub;
    const saved = saveEvaluationState(slug, evalState, {
      title: `Recorded submission for Round ${round.order}`,
      detail: `${targetObj ? targetObj.name : targetKey}`
    });
    return { ...saved, submission: nextSub };
  }

  function saveRoundRubric(slug, roundId, rubricPatch, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Configured round not found.' };

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    const patch = rubricPatch && typeof rubricPatch === 'object' ? rubricPatch : {};
    const mergedCriteria = Array.isArray(patch.criteria)
      ? patch.criteria.map((c, i) => normalizeRubricCriterion(c, i)).filter((c) => Boolean(c.title))
      : rEval.rubric.criteria;

    const computedMax = mergedCriteria.length > 0
      ? mergedCriteria.reduce((acc, c) => acc + c.maxMarks, 0)
      : (Number.isFinite(Number(patch.maxScore)) && Number(patch.maxScore) > 0
          ? Number(patch.maxScore)
          : rEval.rubric.maxScore);

    rEval.rubric = {
      ...rEval.rubric,
      ...patch,
      criteria: mergedCriteria,
      maxScore: computedMax
    };

    const res = saveEvaluationState(slug, evalState, {
      title: `Updated evaluation rubric for Round ${round.order}`,
      detail: `${mergedCriteria.length} criteria • Max ${computedMax} marks`
    });
    return { ...res, rubric: rEval.rubric };
  }

  function addRubricCriterion(slug, roundId, critData, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const rEval = ev.evaluationState && ev.evaluationState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };
    const title = String((critData && critData.title) || '').trim();
    const maxMarks = Number(critData && critData.maxMarks);
    if (!title) return { ok: false, error: 'Criterion title is required.' };
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) return { ok: false, error: 'Criterion maximum marks must be greater than 0.' };

    const nextCriteria = [
      ...rEval.rubric.criteria,
      normalizeRubricCriterion({ ...critData, id: createContentItemId('crit'), title, maxMarks }, rEval.rubric.criteria.length)
    ];
    return saveRoundRubric(slug, roundId, { mode: 'rubric', criteria: nextCriteria }, actor);
  }

  function updateRubricCriterion(slug, roundId, critId, patch, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const rEval = ev.evaluationState && ev.evaluationState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };
    if (!rEval.rubric.criteria.some((c) => c.id === critId)) return { ok: false, error: 'Criterion not found.' };
    const nextCriteria = rEval.rubric.criteria.map((c, idx) => (
      c.id === critId ? normalizeRubricCriterion({ ...c, ...(patch || {}), id: critId }, idx) : c
    ));
    return saveRoundRubric(slug, roundId, { criteria: nextCriteria }, actor);
  }

  function deleteRubricCriterion(slug, roundId, critId, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const rEval = ev.evaluationState && ev.evaluationState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };
    const nextCriteria = rEval.rubric.criteria.filter((c) => c.id !== critId).map((c, idx) => ({ ...c, order: idx + 1 }));
    return saveRoundRubric(slug, roundId, { criteria: nextCriteria }, actor);
  }

  function reorderRubricCriteria(slug, roundId, orderedIds, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const rEval = ev.evaluationState && ev.evaluationState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };
    const byId = new Map(rEval.rubric.criteria.map((c) => [c.id, c]));
    const reordered = [];
    (Array.isArray(orderedIds) ? orderedIds : []).forEach((id) => {
      if (byId.has(id)) {
        reordered.push(byId.get(id));
        byId.delete(id);
      }
    });
    byId.forEach((leftover) => reordered.push(leftover));
    return saveRoundRubric(slug, roundId, { criteria: reordered }, actor);
  }

  function saveEvaluationScore(slug, roundId, targetKey, payload, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round evaluation store missing.' };

    const p = payload && typeof payload === 'object' ? payload : {};
    const criteria = Array.isArray(rEval.rubric.criteria) ? rEval.rubric.criteria : [];
    const usesRubric = criteria.length > 0 && p.criteriaMarks && typeof p.criteriaMarks === 'object';

    let awardedMarks = 0;
    let maxMarks = computeRubricMax(rEval.rubric, round.scoring ? round.scoring.maxScore : 100);
    const cleanCriteriaMarks = {};

    if (usesRubric) {
      for (const crit of criteria) {
        const val = Number(p.criteriaMarks[crit.id] != null ? p.criteriaMarks[crit.id] : 0);
        if (!Number.isFinite(val) || val < 0) {
          return { ok: false, error: `Score for "${crit.title}" cannot be negative.` };
        }
        if (val > crit.maxMarks) {
          return { ok: false, error: `Score for "${crit.title}" (${val}) exceeds maximum allowed (${crit.maxMarks}).` };
        }
        cleanCriteriaMarks[crit.id] = Math.round(val * 100) / 100;
        awardedMarks += cleanCriteriaMarks[crit.id];
      }
      awardedMarks = Math.round(awardedMarks * 100) / 100;
    } else {
      if (Number.isFinite(Number(p.maxMarks)) && Number(p.maxMarks) > 0) {
        maxMarks = Math.round(Number(p.maxMarks) * 100) / 100;
      }
      const rawAwarded = Number(p.awardedMarks != null ? p.awardedMarks : 0);
      if (!Number.isFinite(rawAwarded)) {
        return { ok: false, error: 'Enter a valid numeric score.' };
      }
      if (rawAwarded < 0 && !p.allowNegativeFromAuto) {
        return { ok: false, error: 'Manual awarded marks cannot be below 0.' };
      }
      if (rawAwarded > maxMarks) {
        return { ok: false, error: `Awarded score (${rawAwarded}) cannot exceed maximum marks (${maxMarks}).` };
      }
      awardedMarks = Math.round(rawAwarded * 100) / 100;
    }

    const parts = String(targetKey || '').split(':');
    const kind = parts[0] === 'team' ? 'team' : 'participant';
    const tid = parts.slice(1).join(':');
    const prev = rEval.scoresByTarget[targetKey];
    const actorRef = formatActorRef(actor);
    const nowIso = new Date().toISOString();
    const status = EVALUATION_STATUSES.includes(p.evaluationStatus)
      ? p.evaluationStatus
      : (prev && EVALUATION_STATUSES.includes(prev.evaluationStatus) ? prev.evaluationStatus : 'Evaluated');

    const record = normalizeEvaluationRecord({
      ...(prev || {}),
      targetKey,
      targetKind: kind,
      targetId: tid,
      awardedMarks,
      maxMarks,
      criteriaMarks: usesRubric ? cleanCriteriaMarks : (prev ? prev.criteriaMarks : {}),
      evaluationStatus: status,
      evaluationNotes: p.evaluationNotes != null ? p.evaluationNotes : (prev ? prev.evaluationNotes : ''),
      publicFeedback: p.publicFeedback != null ? p.publicFeedback : (prev ? prev.publicFeedback : ''),
      evaluatorId: actorRef.actorId,
      evaluatorName: actorRef.actorName,
      evaluatedAt: status === 'Evaluated' || status === 'Approved' ? nowIso : (prev ? prev.evaluatedAt : ''),
      updatedAt: nowIso
    }, targetKey, maxMarks);

    rEval.scoresByTarget[targetKey] = record;
    const saved = saveEvaluationState(slug, evalState, {
      title: `Scored Round ${round.order}: ${record.awardedMarks}/${record.maxMarks}`,
      detail: `${targetKey} • Status: ${record.evaluationStatus}`
    });
    return { ...saved, evaluation: record };
  }

  function reopenEvaluation(slug, roundId, targetKey, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    const rec = rEval && rEval.scoresByTarget[targetKey];
    if (!rec) return { ok: false, error: 'Evaluation record not found to reopen.' };

    const actorRef = formatActorRef(actor);
    rec.evaluationStatus = 'Under Review';
    rec.reopenedAt = new Date().toISOString();
    rec.updatedAt = rec.reopenedAt;
    rec.evaluatorId = actorRef.actorId;
    rec.evaluatorName = actorRef.actorName;
    rEval.scoresByTarget[targetKey] = normalizeEvaluationRecord(rec, targetKey, rec.maxMarks);

    const saved = saveEvaluationState(slug, evalState, {
      title: `Reopened evaluation for review`,
      detail: `${targetKey}`
    });
    return { ...saved, evaluation: rEval.scoresByTarget[targetKey] };
  }

  function evaluateSingleMcqQuestion(question, rawAnswer, opts) {
    const q = question || {};
    const options = opts || {};
    const applyNegative = Boolean(options.applyNegativeMarking);
    const multiRule = options.multiAnswerRule === 'partial_credit' ? 'partial_credit' : 'exact_match';
    const maxQMarks = Math.max(0, Number(q.marks) || 0);
    const negQMarks = Math.max(0, Number(q.negativeMarks) || 0);

    if (q.questionType === 'short_answer') {
      const ansText = String(rawAnswer == null ? '' : rawAnswer).trim();
      if (!ansText) return { status: 'unanswered', awarded: 0, maxMarks: maxQMarks };
      const keyText = String(q.acceptedAnswer || '').trim();
      if (keyText && ansText.toLowerCase() === keyText.toLowerCase()) {
        return { status: 'correct', awarded: maxQMarks, maxMarks: maxQMarks };
      }
      return { status: 'wrong', awarded: applyNegative ? -negQMarks : 0, maxMarks: maxQMarks };
    }

    if (q.questionType === 'mcq_multi') {
      const selArr = Array.isArray(rawAnswer)
        ? rawAnswer
        : (rawAnswer !== '' && rawAnswer != null ? [rawAnswer] : []);
      const selSet = new Set(selArr.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n >= 0));
      if (selSet.size === 0) return { status: 'unanswered', awarded: 0, maxMarks: maxQMarks };

      const correctSet = new Set(
        Array.isArray(q.correctOptionIndices) && q.correctOptionIndices.length
          ? q.correctOptionIndices
          : (q.correctOptionIndex != null ? [q.correctOptionIndex] : [])
      );
      if (correctSet.size === 0) return { status: 'unanswered', awarded: 0, maxMarks: maxQMarks };

      let correctHits = 0;
      let wrongHits = 0;
      selSet.forEach((pick) => {
        if (correctSet.has(pick)) correctHits += 1;
        else wrongHits += 1;
      });

      const isExact = wrongHits === 0 && correctHits === correctSet.size;
      if (isExact) {
        return { status: 'correct', awarded: maxQMarks, maxMarks: maxQMarks };
      }
      if (multiRule === 'exact_match') {
        return { status: 'wrong', awarded: applyNegative ? -negQMarks : 0, maxMarks: maxQMarks };
      }
      // Partial credit rule: proportional credit per correct pick minus deduction per wrong pick, strictly capped <= maxQMarks
      let rawScore = (correctHits / correctSet.size) * maxQMarks;
      if (wrongHits > 0) {
        const penaltyUnit = applyNegative && negQMarks > 0
          ? negQMarks
          : (maxQMarks / Math.max(1, correctSet.size));
        rawScore -= wrongHits * penaltyUnit;
      }
      if (!applyNegative) rawScore = Math.max(0, rawScore);
      const clamped = Math.min(maxQMarks, Math.round(rawScore * 100) / 100);
      return {
        status: clamped > 0 ? 'partial' : 'wrong',
        awarded: clamped,
        maxMarks: maxQMarks
      };
    }

    // Single-choice MCQ or True/False
    if (rawAnswer === '' || rawAnswer == null || (Array.isArray(rawAnswer) && rawAnswer.length === 0)) {
      return { status: 'unanswered', awarded: 0, maxMarks: maxQMarks };
    }
    const picked = Array.isArray(rawAnswer) ? Number(rawAnswer[0]) : Number(rawAnswer);
    if (!Number.isFinite(picked)) return { status: 'unanswered', awarded: 0, maxMarks: maxQMarks };
    if (picked === q.correctOptionIndex) {
      return { status: 'correct', awarded: maxQMarks, maxMarks: maxQMarks };
    }
    return { status: 'wrong', awarded: applyNegative ? -negQMarks : 0, maxMarks: maxQMarks };
  }

  function autoEvaluateRoundMcq(slug, roundId, targetKey, answersByQuestionId, actor, opts) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const pkg = getRoundContentPackage(slug, roundId);
    if (!pkg || !Array.isArray(pkg.questions) || pkg.questions.length === 0) {
      return { ok: false, error: 'No structured quiz or MCQ questions found for automatic evaluation in this round.' };
    }

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    const options = {
      multiAnswerRule: (opts && opts.multiAnswerRule) || rEval.rubric.multiAnswerRule || 'exact_match',
      applyNegativeMarking: (opts && typeof opts.applyNegativeMarking === 'boolean')
        ? opts.applyNegativeMarking
        : Boolean(rEval.rubric.applyNegativeMarking)
    };

    const ansMap = answersByQuestionId && typeof answersByQuestionId === 'object' ? answersByQuestionId : {};
    let totalAwarded = 0;
    let totalMax = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let partialCount = 0;

    pkg.questions.forEach((q) => {
      const outcome = evaluateSingleMcqQuestion(q, ansMap[q.id], options);
      totalAwarded += outcome.awarded;
      totalMax += outcome.maxMarks;
      if (outcome.status === 'correct') correctCount += 1;
      else if (outcome.status === 'partial') partialCount += 1;
      else if (outcome.status === 'wrong') wrongCount += 1;
      else unansweredCount += 1;
    });

    totalAwarded = Math.round(totalAwarded * 100) / 100;
    totalMax = Math.max(1, Math.round(totalMax * 100) / 100);

    // Save/update submission responses & score cleanly in single idempotent entry
    const nowIso = new Date().toISOString();
    const parts = String(targetKey || '').split(':');
    const kind = parts[0] === 'team' ? 'team' : 'participant';
    const tid = parts.slice(1).join(':');
    const prevSub = rEval.submissionsByTarget[targetKey];
    rEval.submissionsByTarget[targetKey] = normalizeRoundSubmission({
      ...(prevSub || {}),
      targetKey,
      targetKind: kind,
      targetId: tid,
      submissionType: 'mcq',
      submittedAt: (opts && opts.submittedAt) || (prevSub && prevSub.submittedAt) || nowIso,
      mcqAnswers: { ...ansMap },
      description: `Completed ${pkg.questions.length - unansweredCount}/${pkg.questions.length} question(s)`,
      updatedAt: nowIso
    }, targetKey);

    const actorRef = formatActorRef(actor);
    rEval.rubric.mode = 'auto_mcq';
    rEval.rubric.maxScore = totalMax;
    rEval.rubric.multiAnswerRule = options.multiAnswerRule;
    rEval.rubric.applyNegativeMarking = options.applyNegativeMarking;

    const breakdown = {
      totalQuestions: pkg.questions.length,
      correctCount,
      partialCount,
      wrongCount,
      unansweredCount,
      autoScore: totalAwarded,
      autoMaxMarks: totalMax,
      multiAnswerRule: options.multiAnswerRule,
      applyNegativeMarking: options.applyNegativeMarking
    };

    const prevScore = rEval.scoresByTarget[targetKey];
    rEval.scoresByTarget[targetKey] = normalizeEvaluationRecord({
      ...(prevScore || {}),
      targetKey,
      targetKind: kind,
      targetId: tid,
      awardedMarks: totalAwarded,
      maxMarks: totalMax,
      evaluationStatus: 'Evaluated',
      evaluatorId: actorRef.actorId,
      evaluatorName: actorRef.actorName || 'Auto MCQ Grader',
      evaluatedAt: nowIso,
      updatedAt: nowIso,
      mcqBreakdown: breakdown
    }, targetKey, totalMax);

    // NOTE: Strictly does NOT auto-publish results (requires explicit organizer publishRoundResults call).
    const saved = saveEvaluationState(slug, evalState, {
      title: `Auto-evaluated Round ${round.order} MCQ (${totalAwarded}/${totalMax})`,
      detail: `${targetKey} • ${correctCount} correct, ${wrongCount} wrong`
    });
    return { ...saved, evaluation: rEval.scoresByTarget[targetKey], breakdown };
  }

  function recalculateRoundMcqScores(slug, roundId, actor, opts) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };

    const subKeys = Object.keys(rEval.submissionsByTarget).filter((k) => rEval.submissionsByTarget[k].submissionType === 'mcq');
    if (opts && typeof opts === 'object') {
      saveRoundRubric(slug, roundId, opts, actor);
    }
    let count = 0;
    subKeys.forEach((tk) => {
      const sub = getEventBySlug(slug).evaluationState.roundEvalsById[roundId].submissionsByTarget[tk];
      if (sub) {
        const res = autoEvaluateRoundMcq(slug, roundId, tk, sub.mcqAnswers, actor, opts);
        if (res.ok) count += 1;
      }
    });
    return { ok: true, recalculatedCount: count, event: getEventBySlug(slug) };
  }

  function compareTargetsWithTieBreaker(a, b, tieBreaker, evalState) {
    // Primary sort: higher awardedMarks (or percentage)
    if (Math.abs(b.awardedMarks - a.awardedMarks) > 1e-6) {
      return b.awardedMarks - a.awardedMarks;
    }
    const rule = (tieBreaker && tieBreaker.primaryRule) || 'earlier_submission';
    if (rule === 'earlier_submission') {
      const ta = a.submittedAt ? Date.parse(a.submittedAt) : Number.MAX_SAFE_INTEGER;
      const tb = b.submittedAt ? Date.parse(b.submittedAt) : Number.MAX_SAFE_INTEGER;
      const safeA = Number.isNaN(ta) ? Number.MAX_SAFE_INTEGER : ta;
      const safeB = Number.isNaN(tb) ? Number.MAX_SAFE_INTEGER : tb;
      if (safeA !== safeB) return safeA - safeB;
    } else if (rule === 'criterion_score' && tieBreaker.criterionId) {
      const ca = Number(a.criteriaMarks && a.criteriaMarks[tieBreaker.criterionId]) || 0;
      const cb = Number(b.criteriaMarks && b.criteriaMarks[tieBreaker.criterionId]) || 0;
      if (Math.abs(cb - ca) > 1e-6) return cb - ca;
    } else if (rule === 'other_round_score' && tieBreaker.refRoundId && evalState && evalState.roundEvalsById[tieBreaker.refRoundId]) {
      const refMap = evalState.roundEvalsById[tieBreaker.refRoundId].scoresByTarget || {};
      const ra = refMap[a.targetKey] ? Number(refMap[a.targetKey].awardedMarks) || 0 : 0;
      const rb = refMap[b.targetKey] ? Number(refMap[b.targetKey].awardedMarks) || 0 : 0;
      if (Math.abs(rb - ra) > 1e-6) return rb - ra;
    } else if (rule === 'manual' && tieBreaker.manualRankOrderOverrides) {
      const oa = Number(tieBreaker.manualRankOrderOverrides[a.targetKey]);
      const ob = Number(tieBreaker.manualRankOrderOverrides[b.targetKey]);
      const validA = Number.isFinite(oa);
      const validB = Number.isFinite(ob);
      if (validA && validB && oa !== ob) return oa - ob;
      if (validA !== validB) return validA ? -1 : 1;
    }
    return 0; // Unresolved exact tie!
  }

  function computeRoundStandings(evOrSlug, roundId) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return [];
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return [];
    const targets = resolveRoundTargets(ev, roundId);
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    const defaultMax = computeRubricMax(rEval.rubric, round && round.scoring ? round.scoring.maxScore : 100);

    const rows = targets.map((t) => {
      const rec = rEval.scoresByTarget[t.targetKey] || null;
      const sub = rEval.submissionsByTarget[t.targetKey] || null;
      const awardedMarks = rec ? rec.awardedMarks : 0;
      const maxMarks = rec ? rec.maxMarks : defaultMax;
      const percentage = rec ? rec.percentage : 0;
      const evalStatus = rec ? rec.evaluationStatus : 'Not Evaluated';
      const isEvaluated = Boolean(rec && (evalStatus === 'Evaluated' || evalStatus === 'Approved' || evalStatus === 'Rejected'));
      return {
        ...t,
        submittedAt: sub ? sub.submittedAt : '',
        hasSubmission: Boolean(sub),
        submission: sub,
        evaluation: rec,
        awardedMarks,
        maxMarks,
        percentage,
        criteriaMarks: rec ? rec.criteriaMarks : {},
        evaluationStatus: evalStatus,
        isEvaluated,
        publicFeedback: rec ? rec.publicFeedback : '',
        evaluationNotes: rec ? rec.evaluationNotes : '',
        evaluatorName: rec ? rec.evaluatorName : '',
        isTied: false,
        rank: null
      };
    });

    const evaluatedRows = rows.filter((r) => r.isEvaluated);
    const unevaluatedRows = rows.filter((r) => !r.isEvaluated).sort((a, b) => a.name.localeCompare(b.name));

    evaluatedRows.sort((a, b) => {
      const cmp = compareTargetsWithTieBreaker(a, b, rEval.tieBreaker, evalState);
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name);
    });

    // Assign ranks carefully preserving exact unresolved ties (same rank!)
    for (let i = 0; i < evaluatedRows.length; i += 1) {
      if (i === 0) {
        evaluatedRows[i].rank = 1;
      } else {
        const prev = evaluatedRows[i - 1];
        const cur = evaluatedRows[i];
        const cmp = compareTargetsWithTieBreaker(prev, cur, rEval.tieBreaker, evalState);
        if (cmp === 0) {
          cur.rank = prev.rank;
          prev.isTied = true;
          cur.isTied = true;
        } else {
          cur.rank = i + 1;
        }
      }
    }

    return [...evaluatedRows, ...unevaluatedRows];
  }

  function saveQualificationConfig(slug, roundId, patch, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };

    const validKeys = new Set(resolveRoundTargets(ev, roundId).map((t) => t.targetKey));
    const p = patch && typeof patch === 'object' ? patch : {};
    rEval.qualification = {
      ...rEval.qualification,
      ...p,
      strategy: QUALIFICATION_STRATEGIES.some((s) => s.key === p.strategy) ? p.strategy : rEval.qualification.strategy,
      topN: p.topN != null ? Math.max(1, Math.round(Number(p.topN) || 1)) : rEval.qualification.topN,
      minScore: p.minScore != null ? Math.max(0, Number(p.minScore) || 0) : rEval.qualification.minScore,
      minPercentage: p.minPercentage != null ? Math.max(0, Math.min(100, Number(p.minPercentage) || 0)) : rEval.qualification.minPercentage,
      manualSelectedKeys: Array.isArray(p.manualSelectedKeys) ? p.manualSelectedKeys.filter((k) => validKeys.has(k)) : rEval.qualification.manualSelectedKeys
    };
    return saveEvaluationState(slug, evalState, {
      title: `Updated qualification rules`,
      detail: `Strategy: ${rEval.qualification.strategy}`
    });
  }

  function saveTieBreakerConfig(slug, roundId, patch, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };
    const p = patch && typeof patch === 'object' ? patch : {};
    rEval.tieBreaker = {
      ...rEval.tieBreaker,
      ...p,
      primaryRule: TIE_BREAKER_MODES.some((m) => m.key === p.primaryRule) ? p.primaryRule : rEval.tieBreaker.primaryRule
    };
    return saveEvaluationState(slug, evalState, {
      title: `Updated tie-breaker rule`,
      detail: `Rule: ${rEval.tieBreaker.primaryRule}`
    });
  }

  function computeQualificationPreview(evOrSlug, roundId) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return null;
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return null;

    const standings = computeRoundStandings(ev, roundId);
    const qCfg = rEval.qualification;
    const pendingEvaluations = standings.filter((row) => !row.isEvaluated && !qCfg.allowPendingEvaluation);
    const pool = qCfg.allowPendingEvaluation ? standings : standings.filter((row) => row.isEvaluated);

    // Exclude explicitly Rejected / Disqualified entries from automatic qualification
    const eligiblePool = pool.filter((row) => row.evaluationStatus !== 'Rejected' && row.liveStatus !== 'Disqualified');

    const qualifiedSet = new Set();
    const tiedBoundaryKeys = [];
    const strat = qCfg.strategy || 'top_n';

    if (strat === 'manual') {
      const manualSet = new Set(qCfg.manualSelectedKeys || []);
      eligiblePool.forEach((row) => {
        if (manualSet.has(row.targetKey)) qualifiedSet.add(row.targetKey);
      });
    } else if (strat === 'min_score') {
      eligiblePool.forEach((row) => {
        if (row.awardedMarks >= qCfg.minScore) qualifiedSet.add(row.targetKey);
      });
    } else if (strat === 'percentage') {
      eligiblePool.forEach((row) => {
        if (row.percentage >= qCfg.minPercentage) qualifiedSet.add(row.targetKey);
      });
    } else if (strat === 'top_n' || strat === 'combined') {
      const cap = Math.max(1, Number(qCfg.topN) || 1);
      const filteredPool = strat === 'combined'
        ? eligiblePool.filter((row) => row.awardedMarks >= qCfg.minScore)
        : eligiblePool;

      const selected = filteredPool.slice(0, cap);
      selected.forEach((row) => qualifiedSet.add(row.targetKey));

      // Never silently exclude tied participants across cutoff! Flag exact boundary ties cleanly.
      if (filteredPool.length > cap && selected.length === cap) {
        const lastIn = selected[selected.length - 1];
        const firstOut = filteredPool[cap];
        if (lastIn && firstOut && compareTargetsWithTieBreaker(lastIn, firstOut, rEval.tieBreaker, evalState) === 0) {
          filteredPool.forEach((row) => {
            if (compareTargetsWithTieBreaker(lastIn, row, rEval.tieBreaker, evalState) === 0) {
              tiedBoundaryKeys.push(row.targetKey);
            }
          });
        }
      }
    }

    const qualified = standings.filter((row) => qualifiedSet.has(row.targetKey));
    const notQualified = standings.filter((row) => !qualifiedSet.has(row.targetKey) && (qCfg.allowPendingEvaluation || row.isEvaluated));
    const allTiedKeys = standings.filter((row) => row.isTied).map((row) => row.targetKey);

    return {
      roundId,
      standings,
      eligibleTotal: standings.length,
      qualified,
      notQualified,
      pendingEvaluations,
      allTiedKeys,
      tiedBoundaryKeys,
      boundaryTieWarning: tiedBoundaryKeys.length > 0
        ? `Unresolved tie detected at cutoff (${tiedBoundaryKeys.length} entries tied). Resolve via tie-breaker or adjust Top N before finalizing.`
        : '',
      finalized: qCfg.finalized,
      progressedKeys: [...(qCfg.progressedKeys || [])]
    };
  }

  function finalizeRoundQualification(slug, roundId, opts, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const preview = computeQualificationPreview(ev, roundId);
    if (!preview) return { ok: false, error: 'Round not found.' };

    const options = opts && typeof opts === 'object' ? opts : {};
    if (preview.tiedBoundaryKeys.length > 0 && !options.allowTiesIncluded && !options.ignoreBoundaryTie) {
      return {
        ok: false,
        requiresTieResolution: true,
        tiedBoundaryKeys: preview.tiedBoundaryKeys,
        error: preview.boundaryTieWarning
      };
    }

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    const nowIso = new Date().toISOString();
    const actorRef = formatActorRef(actor);

    const qualifiedKeys = options.includeBoundaryTies
      ? Array.from(new Set([...preview.qualified.map((q) => q.targetKey), ...preview.tiedBoundaryKeys]))
      : preview.qualified.map((q) => q.targetKey);

    rEval.qualification.finalized = true;
    rEval.qualification.finalizedAt = nowIso;
    rEval.qualification.qualifiedKeys = qualifiedKeys;
    rEval.qualification.history.unshift({
      id: createContentItemId('qhist'),
      action: 'finalized',
      summary: `Finalized ${qualifiedKeys.length} qualified entry(ies) via "${rEval.qualification.strategy}".`,
      count: qualifiedKeys.length,
      timestamp: nowIso,
      actorName: actorRef.actorName
    });

    const saved = saveEvaluationState(slug, evalState, {
      title: `Finalized Round qualification (${qualifiedKeys.length} qualified)`,
      detail: `Strategy: ${rEval.qualification.strategy}`
    });
    return { ...saved, qualifiedKeys };
  }

  function reopenRoundQualification(slug, roundId, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    if (!rEval) return { ok: false, error: 'Round not found.' };

    const nowIso = new Date().toISOString();
    const actorRef = formatActorRef(actor);
    rEval.qualification.finalized = false;
    rEval.qualification.history.unshift({
      id: createContentItemId('qhist'),
      action: 'reopened',
      summary: 'Reopened round qualification for review.',
      count: rEval.qualification.qualifiedKeys.length,
      timestamp: nowIso,
      actorName: actorRef.actorName
    });
    return saveEvaluationState(slug, evalState, null);
  }

  function progressQualifiedToNextRound(slug, roundId, nextRoundId, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const srcRound = (ev.rounds || []).find((r) => r.id === roundId);
    const destRound = (ev.rounds || []).find((r) => r.id === nextRoundId);
    if (!srcRound || !destRound) return { ok: false, error: 'Source or destination round not found.' };
    if (destRound.id === srcRound.id || destRound.order <= srcRound.order) {
      return { ok: false, error: 'Destination round must appear strictly after the current round.' };
    }
    if (destRound.enabled === false || destRound.status === 'Disabled') {
      return { ok: false, error: `"${destRound.name}" is disabled in Round Builder.` };
    }

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const srcEval = evalState.roundEvalsById[srcRound.id];
    const qualifiedKeys = srcEval.qualification.finalized
      ? srcEval.qualification.qualifiedKeys
      : computeQualificationPreview(ev, srcRound.id).qualified.map((q) => q.targetKey);

    if (!qualifiedKeys.length) {
      return { ok: false, error: 'No qualified participants or teams selected to move to the next round.' };
    }

    // Preserve participant/team identity, prevent duplicates, initialize missing LiveOps entries without auto-starting round!
    const liveOps = normalizeLiveOps(ev.liveOps, ev);
    const nextLive = liveOps.roundsById[destRound.id];
    const existingProgressed = new Set(srcEval.qualification.progressedKeys || []);
    let newlyAdded = 0;

    qualifiedKeys.forEach((tk) => {
      if (!existingProgressed.has(tk)) {
        existingProgressed.add(tk);
        newlyAdded += 1;
      }
      const parts = String(tk).split(':');
      const kind = parts[0];
      const tid = parts.slice(1).join(':');
      if (nextLive) {
        if (kind === 'team' && !nextLive.teamStatuses[tid]) {
          nextLive.teamStatuses[tid] = 'Not Started';
        } else if (kind === 'participant' && !nextLive.participantStatuses[tid]) {
          nextLive.participantStatuses[tid] = 'Not Started';
        }
      }
    });

    const nowIso = new Date().toISOString();
    const actorRef = formatActorRef(actor);
    srcEval.qualification.finalized = true;
    srcEval.qualification.finalizedAt = srcEval.qualification.finalizedAt || nowIso;
    srcEval.qualification.qualifiedKeys = qualifiedKeys;
    srcEval.qualification.targetNextRoundId = destRound.id;
    srcEval.qualification.progressedKeys = Array.from(existingProgressed);
    srcEval.qualification.progressedAt = nowIso;
    srcEval.qualification.history.unshift({
      id: createContentItemId('qhist'),
      action: 'progressed',
      summary: `Moved ${qualifiedKeys.length} qualifier(s) (${newlyAdded} new) into Round ${destRound.order} ("${destRound.name}"). Next round stays Upcoming until started in Live Control.`,
      count: qualifiedKeys.length,
      timestamp: nowIso,
      actorName: actorRef.actorName
    });

    appendLiveActivity(liveOps, slug, {
      roundId: destRound.id,
      activityType: 'qualification_progressed',
      description: `Promoted ${qualifiedKeys.length} qualified entry(ies) from Round ${srcRound.order} to Round ${destRound.order} ("${destRound.name}").`,
      timestamp: nowIso,
      actor
    });

    const upRes = updateEvent(slug, {
      evaluationState: evalState,
      liveOps,
      _skipLog: true
    });
    if (upRes.ok) {
      logActivity(
        'qualification',
        `Progressed ${qualifiedKeys.length} qualifier(s) to Round ${destRound.order}`,
        `${ev.name}`,
        slug
      );
    }
    return {
      ok: Boolean(upRes.ok),
      event: upRes.event,
      progressedCount: qualifiedKeys.length,
      newlyAddedCount: newlyAdded
    };
  }

  function validateOverallWeights(ev, configPatch) {
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const ov = { ...evalState.overallConfig, ...(configPatch || {}) };
    if (ov.mode !== 'weighted_percentage') return { ok: true, totalWeight: 100 };
    const ids = Array.isArray(ov.includedRoundIds) ? ov.includedRoundIds : [];
    if (!ids.length) return { ok: false, error: 'Select at least one round for overall weighted scoring.', totalWeight: 0 };
    const total = Math.round(ids.reduce((sum, id) => sum + Math.max(0, Number(ov.weightsByRoundId && ov.weightsByRoundId[id]) || 0), 0) * 100) / 100;
    if (Math.abs(total - 100) > 0.05) {
      return { ok: false, totalWeight: total, error: `Round weights sum to ${total}%. Weighted scoring expects total weight equal to 100%.` };
    }
    return { ok: true, totalWeight: total };
  }

  function saveOverallScoringConfig(slug, patch, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const validCheck = validateOverallWeights(ev, patch);
    if (!validCheck.ok) return { ok: false, error: validCheck.error };

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    evalState.overallConfig = {
      ...evalState.overallConfig,
      ...(patch || {})
    };
    return saveEvaluationState(slug, evalState, {
      title: `Updated overall scoring configuration`,
      detail: `Mode: ${evalState.overallConfig.mode}`
    });
  }

  function computeOverallLeaderboard(evOrSlug) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return [];
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const ov = evalState.overallConfig;
    const includedIds = Array.isArray(ov.includedRoundIds) ? ov.includedRoundIds : [];

    const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
    const baseTargets = useTeams
      ? (ev.teams || []).map((t) => ({
          targetKey: buildTargetKey('team', t.id),
          targetKind: 'team',
          targetId: t.id,
          displayId: t.id,
          name: t.teamName || t.name || 'Team'
        }))
      : (ev.participants || [])
          .filter((p) => p.registrationStatus !== 'Cancelled' && p.registrationStatus !== 'Rejected')
          .map((p) => ({
            targetKey: buildTargetKey('participant', p.id),
            targetKind: 'participant',
            targetId: p.id,
            displayId: p.registrationId || p.id,
            name: p.fullName
          }));

    const rows = baseTargets.map((t) => {
      let totalWeightedPct = 0;
      let rawSum = 0;
      let rawMaxSum = 0;
      let earliestMs = Number.MAX_SAFE_INTEGER;
      let earliestIso = '';
      let scoredRoundsCount = 0;
      const roundScores = {};
      let latestQualifiedRoundOrder = 0;
      let isQualifiedLatest = false;

      includedIds.forEach((rid) => {
        const round = (ev.rounds || []).find((r) => r.id === rid);
        const rEval = evalState.roundEvalsById[rid];
        if (!round || !rEval) return;
        const rec = rEval.scoresByTarget[t.targetKey];
        const sub = rEval.submissionsByTarget[t.targetKey];
        const rMax = rec ? rec.maxMarks : computeRubricMax(rEval.rubric, round.scoring ? round.scoring.maxScore : 100);
        const rAwarded = rec && (rec.evaluationStatus === 'Evaluated' || rec.evaluationStatus === 'Approved') ? rec.awardedMarks : 0;
        const normPct = rMax > 0 && rec && (rec.evaluationStatus === 'Evaluated' || rec.evaluationStatus === 'Approved')
          ? (rAwarded / rMax) * 100
          : 0;
        const weight = Number(ov.weightsByRoundId && ov.weightsByRoundId[rid]) || 0;

        if (rec && (rec.evaluationStatus === 'Evaluated' || rec.evaluationStatus === 'Approved')) {
          scoredRoundsCount += 1;
        }
        if (sub && sub.submittedAt) {
          const ts = Date.parse(sub.submittedAt);
          if (!Number.isNaN(ts) && ts < earliestMs) {
            earliestMs = ts;
            earliestIso = sub.submittedAt;
          }
        }
        rawSum += rAwarded;
        rawMaxSum += rMax;
        totalWeightedPct += (normPct * weight) / 100;
        roundScores[rid] = {
          roundOrder: round.order,
          roundName: round.name,
          awardedMarks: Math.round(rAwarded * 100) / 100,
          maxMarks: rMax,
          percentage: Math.round(normPct * 100) / 100,
          weight
        };
        if (rEval.qualification && Array.isArray(rEval.qualification.qualifiedKeys) && rEval.qualification.qualifiedKeys.includes(t.targetKey) && round.order >= latestQualifiedRoundOrder) {
          latestQualifiedRoundOrder = round.order;
          isQualifiedLatest = true;
        }
      });

      let overallScore = 0;
      let overallMax = 100;
      if (ov.mode === 'sum_raw') {
        overallScore = Math.round(rawSum * 100) / 100;
        overallMax = Math.max(1, Math.round(rawMaxSum * 100) / 100);
      } else if (ov.mode === 'manual_final') {
        const manVal = ov.manualFinalOverrides && Number(ov.manualFinalOverrides[t.targetKey]);
        overallScore = Number.isFinite(manVal) ? Math.round(manVal * 100) / 100 : Math.round(totalWeightedPct * 100) / 100;
        overallMax = 100;
      } else {
        overallScore = Math.round(totalWeightedPct * 100) / 100;
        overallMax = 100;
      }

      const overallPct = overallMax > 0 ? Math.round((overallScore / overallMax) * 10000) / 100 : 0;
      return {
        ...t,
        scoredRoundsCount,
        roundScores,
        overallScore,
        overallMax,
        overallPercentage: overallPct,
        earliestSubmissionAt: earliestIso,
        earliestMs,
        isQualifiedLatest,
        latestQualifiedRoundOrder,
        rank: null,
        isTied: false
      };
    });

    rows.sort((a, b) => {
      if (Math.abs(b.overallScore - a.overallScore) > 1e-6) return b.overallScore - a.overallScore;
      if (ov.tieBreakerRule === 'earlier_submission' && a.earliestMs !== b.earliestMs) {
        return a.earliestMs - b.earliestMs;
      }
      if (ov.tieBreakerRule === 'manual' && ov.manualRankOrderOverrides) {
        const oa = Number(ov.manualRankOrderOverrides[a.targetKey]);
        const ob = Number(ov.manualRankOrderOverrides[b.targetKey]);
        if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
      }
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < rows.length; i += 1) {
      if (i === 0) {
        rows[i].rank = 1;
      } else {
        const prev = rows[i - 1];
        const cur = rows[i];
        const tiedScore = Math.abs(prev.overallScore - cur.overallScore) <= 1e-6;
        const tiedSub = ov.tieBreakerRule !== 'earlier_submission' || prev.earliestMs === cur.earliestMs;
        if (tiedScore && tiedSub) {
          cur.rank = prev.rank;
          prev.isTied = true;
          cur.isTied = true;
        } else {
          cur.rank = i + 1;
        }
      }
    }

    return rows;
  }

  function publishRoundResults(slug, roundId, flags, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const round = (ev.rounds || []).find((r) => r.id === roundId);
    if (!round) return { ok: false, error: 'Round not found.' };

    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const rEval = evalState.roundEvalsById[roundId];
    const nowIso = new Date().toISOString();
    const f = flags && typeof flags === 'object' ? flags : {};
    const roundPublished = typeof f.roundPublished === 'boolean' ? f.roundPublished : rEval.publication.roundPublished;
    const leaderboardPublished = typeof f.leaderboardPublished === 'boolean' ? f.leaderboardPublished : rEval.publication.leaderboardPublished;
    const showPublicFeedback = typeof f.showPublicFeedback === 'boolean' ? f.showPublicFeedback : rEval.publication.showPublicFeedback;

    rEval.publication = {
      roundPublished,
      leaderboardPublished,
      showPublicFeedback,
      publishedAt: (roundPublished || leaderboardPublished) ? (rEval.publication.publishedAt || nowIso) : '',
      updatedAt: nowIso
    };
    return saveEvaluationState(slug, evalState, {
      title: `${roundPublished ? 'Published' : 'Unpublished'} Round ${round.order} results`,
      detail: `Leaderboard: ${leaderboardPublished ? 'Public' : 'Hidden'}`
    });
  }

  function publishOverallResults(slug, flags, actor) {
    const ev = getEventBySlug(slug);
    if (!ev) return { ok: false, error: 'Event not found.' };
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);
    const nowIso = new Date().toISOString();
    const f = flags && typeof flags === 'object' ? flags : {};
    const published = typeof f.published === 'boolean' ? f.published : !evalState.overallConfig.published;
    evalState.overallConfig.published = published;
    if (typeof f.showPublicFeedback === 'boolean') {
      evalState.overallConfig.showPublicFeedback = f.showPublicFeedback;
    }
    evalState.overallConfig.publishedAt = published ? (evalState.overallConfig.publishedAt || nowIso) : '';
    return saveEvaluationState(slug, evalState, {
      title: `${published ? 'Published' : 'Unpublished'} overall leaderboard for "${ev.name}"`,
      detail: published ? 'Visible on public event page & participant portal' : 'Hidden from participants'
    });
  }

  function getPublishedEventResults(evOrSlug, user) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return null;
    const evalState = normalizeEvaluationState(ev.evaluationState, ev);

    const publishedRounds = (ev.rounds || []).map((round) => {
      const rEval = evalState.roundEvalsById[round.id];
      const pub = rEval ? rEval.publication : { roundPublished: false, leaderboardPublished: false };
      if (!pub.roundPublished && !pub.leaderboardPublished) {
        return {
          roundId: round.id,
          roundOrder: round.order,
          roundName: round.name,
          published: false,
          leaderboardPublished: false,
          entries: []
        };
      }
      const standings = computeRoundStandings(ev, round.id).filter((row) => row.isEvaluated);
      const qSet = new Set(rEval.qualification.qualifiedKeys || []);
      return {
        roundId: round.id,
        roundOrder: round.order,
        roundName: round.name,
        published: pub.roundPublished,
        leaderboardPublished: pub.leaderboardPublished,
        publishedAt: pub.publishedAt,
        entries: standings.map((row) => ({
          rank: row.rank,
          isTied: row.isTied,
          targetKey: row.targetKey,
          displayId: row.displayId,
          name: row.name,
          awardedMarks: row.awardedMarks,
          maxMarks: row.maxMarks,
          percentage: row.percentage,
          qualified: qSet.has(row.targetKey),
          publicFeedback: pub.showPublicFeedback ? row.publicFeedback : ''
          // Strictly omits private evaluationNotes!
        }))
      };
    });

    const overallPublished = Boolean(evalState.overallConfig.published);
    const overallEntries = overallPublished
      ? computeOverallLeaderboard(ev).map((row) => ({
          rank: row.rank,
          isTied: row.isTied,
          targetKey: row.targetKey,
          displayId: row.displayId,
          name: row.name,
          overallScore: row.overallScore,
          overallMax: row.overallMax,
          overallPercentage: row.overallPercentage,
          qualified: row.isQualifiedLatest,
          roundScores: row.roundScores
        }))
      : [];

    let myResultSummary = null;
    if (user) {
      const reg = findExistingUserParticipant(ev, user);
      if (reg) {
        const myTeamKey = reg.teamId ? buildTargetKey('team', reg.teamId) : '';
        const myPartKey = buildTargetKey('participant', reg.id);
        const matchKey = ev.teamConfig && ev.teamConfig.supported ? myTeamKey : myPartKey;
        const ovEntry = matchKey ? overallEntries.find((e) => e.targetKey === matchKey) : null;
        const roundMatches = publishedRounds
          .filter((pr) => pr.published)
          .map((pr) => ({
            roundOrder: pr.roundOrder,
            roundName: pr.roundName,
            entry: matchKey ? pr.entries.find((e) => e.targetKey === matchKey) : null
          }))
          .filter((x) => Boolean(x.entry));
        myResultSummary = { overallEntry: ovEntry || null, roundEntries: roundMatches };
      }
    }

    return {
      eventSlug: ev.slug,
      eventName: ev.name,
      overallPublished,
      overallPublishedAt: evalState.overallConfig.publishedAt || '',
      overallMode: evalState.overallConfig.mode,
      overallEntries,
      publishedRounds,
      myResultSummary
    };
  }

  function escapeCsvCell(val) {
    const str = String(val == null ? '' : val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function buildResultsCsv(evOrSlug, scope, roundId) {
    const ev = typeof evOrSlug === 'string' ? getEventBySlug(evOrSlug) : evOrSlug;
    if (!ev) return '';
    const rounds = Array.isArray(ev.rounds) ? ev.rounds : [];
    const targetRound = roundId ? rounds.find((r) => r.id === roundId) : rounds[0];
    const rows = [];

    if (scope === 'overall_leaderboard' || scope === 'team_results' || scope === 'participant_results') {
      rows.push(['Event', 'Type', 'Rank', 'Tied', 'ID', 'Name', 'Overall Score', 'Max', 'Overall %', 'Rounds Scored', 'Latest Qualification']);
      let board = computeOverallLeaderboard(ev);
      if (scope === 'team_results') board = board.filter((x) => x.targetKind === 'team');
      if (scope === 'participant_results') board = board.filter((x) => x.targetKind === 'participant');
      board.forEach((r) => {
        rows.push([
          ev.name,
          r.targetKind,
          r.rank != null ? r.rank : '-',
          r.isTied ? 'Yes' : 'No',
          r.displayId,
          r.name,
          r.overallScore,
          r.overallMax,
          `${r.overallPercentage}%`,
          r.scoredRoundsCount,
          r.isQualifiedLatest ? `Qualified (R${r.latestQualifiedRoundOrder})` : '—'
        ]);
      });
    } else if (scope === 'qualified' && targetRound) {
      const preview = computeQualificationPreview(ev, targetRound.id);
      rows.push(['Event', 'Round', 'Rank', 'ID', 'Name', 'Score', 'Max Marks', 'Percentage', 'Qualification Strategy']);
      (preview ? preview.qualified : []).forEach((r) => {
        rows.push([
          ev.name,
          `R${targetRound.order}: ${targetRound.name}`,
          r.rank != null ? r.rank : '-',
          r.displayId,
          r.name,
          r.awardedMarks,
          r.maxMarks,
          `${r.percentage}%`,
          ev.evaluationState.roundEvalsById[targetRound.id].qualification.strategy
        ]);
      });
    } else if (targetRound) {
      // 'round_scores' or 'evaluations'
      const standings = computeRoundStandings(ev, targetRound.id);
      const includeNotes = scope === 'evaluations';
      rows.push(
        includeNotes
          ? ['Event', 'Round', 'Rank', 'ID', 'Name', 'Score', 'Max Marks', 'Percentage', 'Evaluation Status', 'Evaluator', 'Public Feedback', 'Internal Notes']
          : ['Event', 'Round', 'Rank', 'ID', 'Name', 'Score', 'Max Marks', 'Percentage', 'Evaluation Status']
      );
      standings.forEach((r) => {
        const base = [
          ev.name,
          `R${targetRound.order}: ${targetRound.name}`,
          r.rank != null ? r.rank : '-',
          r.displayId,
          r.name,
          r.awardedMarks,
          r.maxMarks,
          `${r.percentage}%`,
          r.evaluationStatus
        ];
        if (includeNotes) {
          base.push(r.evaluatorName || '', r.publicFeedback || '', r.evaluationNotes || '');
        }
        rows.push(base);
      });
    }

    return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  }

  function duplicateEvent(slug) {
    const src = getEventBySlug(slug);
    if (!src) return null;

    const existingSlugs = new Set(getAllEvents().map((e) => e.slug));
    const base = src.slug.replace(/-copy(-\d+)?$/, '');
    let candidate = `${base}-copy`;
    let n = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${base}-copy-${n++}`;
    }

    const clonedRounds = deepCloneRounds(src.rounds, true);
    const clonedContentMap = {};
    const srcContentMap = normalizeEventRoundContent(src.roundContentById, src);
    (src.rounds || []).forEach((oldRound, idx) => {
      const newRound = clonedRounds[idx];
      if (!oldRound || !newRound) return;
      const oldPkg = srcContentMap[oldRound.id];
      if (oldPkg) {
        const deepPkg = JSON.parse(JSON.stringify(oldPkg));
        deepPkg.roundId = newRound.id;
        deepPkg.eventId = candidate;
        deepPkg.availability = {
          ...(deepPkg.availability || {}),
          mode: 'locked'
        };
        if (deepPkg.contentStatus === 'Published') {
          deepPkg.contentStatus = 'Draft';
        }
        clonedContentMap[newRound.id] = deepPkg;
      }
    });
    const clonedTeamConfig = normalizeTeamConfig(src.teamConfig, src.participationType);
    const clonedRegConfig = normalizeRegistrationConfig(src.registrationConfig, src);

    const copy = normalizeEvent({
      ...src,
      slug: candidate,
      name: `${src.name} (Copy)`,
      isSample: false,
      isPreviewDraft: true,
      isCreatedEvent: true,
      statusKey: 'draft',
      eventStatus: 'Draft',
      visibility: 'private',
      registrationCount: 0,
      participants: [],
      teams: [],
      teamConfig: clonedTeamConfig,
      registrationConfig: clonedRegConfig,
      rounds: clonedRounds,
      roundContentById: clonedContentMap,
      evaluationState: (() => {
        const srcEval = normalizeEvaluationState(src.evaluationState, src);
        const clonedMap = {};
        (src.rounds || []).forEach((oldR, idx) => {
          const newR = clonedRounds[idx];
          if (!oldR || !newR) return;
          const oldRe = srcEval.roundEvalsById[oldR.id];
          if (oldRe && oldRe.rubric) {
            clonedMap[newR.id] = {
              rubric: JSON.parse(JSON.stringify(oldRe.rubric)),
              submissionsByTarget: {},
              scoresByTarget: {},
              qualification: { ...oldRe.qualification, finalized: false, finalizedAt: '', qualifiedKeys: [], progressedKeys: [], history: [] },
              publication: { roundPublished: false, leaderboardPublished: false, showPublicFeedback: false, publishedAt: '' }
            };
          }
        });
        return {
          roundEvalsById: clonedMap,
          overallConfig: {
            ...srcEval.overallConfig,
            includedRoundIds: clonedRounds.filter((r) => r.enabled !== false).map((r) => r.id),
            weightsByRoundId: {},
            manualFinalOverrides: {},
            published: false,
            publishedAt: ''
          }
        };
      })(),
      liveOps: null,
      createdAt: new Date().toISOString()
    });

    const previews = getPreviewEvents().filter((item) => item && item.slug !== candidate);
    previews.unshift(copy);
    if (!safeJsonWrite(PREVIEW_STORAGE_KEY, previews)) {
      copy.coverImage = '';
      previews[0] = copy;
      safeJsonWrite(PREVIEW_STORAGE_KEY, previews);
    }
    logActivity('duplicate', `Duplicated "${src.name}"`, `New draft: "${copy.name}"`, copy.slug);
    return copy;
  }

  function deleteEvent(slug) {
    const target = getEventBySlug(slug);
    if (!target) return false;
    if (_backendMode === 'supabase') {
      removeRemoteEvent(slug);
      logActivity('delete', `Deleted event "${target.name}"`, 'Removed from PostgreSQL workspace', '');
      notifyRemoteSync('delete', target, target);
      return true;
    }

    const previews = getPreviewEvents().filter((item) => item && item.slug !== slug);
    safeJsonWrite(PREVIEW_STORAGE_KEY, previews);

    const overrides = getOverrides();
    if (overrides[slug]) {
      delete overrides[slug];
      safeJsonWrite(OVERRIDES_STORAGE_KEY, overrides);
    }

    const collabs = safeJsonRead(COLLABS_STORAGE_KEY, {});
    if (collabs && collabs[slug]) {
      delete collabs[slug];
      safeJsonWrite(COLLABS_STORAGE_KEY, collabs);
    }

    if (SAMPLE_EVENTS.some((s) => s.slug === slug)) {
      const deleted = getDeletedSlugs();
      if (!deleted.includes(slug)) {
        deleted.push(slug);
        safeJsonWrite(DELETED_STORAGE_KEY, deleted);
      }
    }

    logActivity('delete', `Deleted event "${target.name}"`, 'Removed from local workspace session', '');
    return true;
  }

  function restoreSampleEvents() {
    safeJsonWrite(DELETED_STORAGE_KEY, []);
    logActivity('restore', 'Restored illustrative sample events', 'Sample workspace catalog re-enabled', '');
  }

  function getDashboardStats(eventsList) {
    const list = Array.isArray(eventsList) ? eventsList : getAllEvents();
    let published = 0;
    let draft = 0;
    let ongoing = 0;
    let totalRegistrations = 0;
    list.forEach((ev) => {
      const k = deriveStatusKey(ev);
      if (k === 'published') published += 1;
      else if (k === 'draft') draft += 1;
      else if (k === 'ongoing') ongoing += 1;
      totalRegistrations += typeof ev.registrationCount === 'number' ? ev.registrationCount : 0;
    });
    return {
      total: list.length,
      published,
      draft,
      ongoing,
      totalRegistrations
    };
  }

  function getCollaborators(slug) {
    if (!slug) return [];
    const map = safeJsonRead(COLLABS_STORAGE_KEY, {});
    return Array.isArray(map[slug]) ? map[slug] : [];
  }

  function addCollaborator(slug, { name, email, role }) {
    if (!slug || !email) return [];
    const map = safeJsonRead(COLLABS_STORAGE_KEY, {});
    const list = Array.isArray(map[slug]) ? map[slug] : [];
    const cleanEmail = String(email).trim().toLowerCase();
    const filtered = list.filter((c) => c.email.toLowerCase() !== cleanEmail);
    const entry = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: String(name || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      role: String(role || 'Event Manager'),
      status: 'Preview Invite (Not Sent)',
      addedAt: new Date().toISOString()
    };
    filtered.unshift(entry);
    map[slug] = filtered;
    safeJsonWrite(COLLABS_STORAGE_KEY, map);
    const ev = getEventBySlug(slug);
    logActivity('collaborator', `Added collaborator ${entry.name}`, `${entry.role} on "${ev ? ev.name : slug}"`, slug);
    return filtered;
  }

  function removeCollaborator(slug, collabId) {
    if (!slug || !collabId) return [];
    const map = safeJsonRead(COLLABS_STORAGE_KEY, {});
    const list = Array.isArray(map[slug]) ? map[slug] : [];
    const next = list.filter((c) => c.id !== collabId);
    map[slug] = next;
    safeJsonWrite(COLLABS_STORAGE_KEY, map);
    return next;
  }

  function getCategories() {
    return CATEGORIES;
  }

  function filterEvents({ query = '', category = 'all', dateWindow = 'all', location = 'all', participation = 'all', sort = 'date' } = {}) {
    const q = query.trim().toLowerCase();
    let list = getAllEvents().filter((ev) => {
      if (category !== 'all' && ev.category !== category) return false;
      if (dateWindow !== 'all' && ev.dateWindow !== dateWindow) return false;
      if (location !== 'all') {
        if (location === 'Online' && ev.mode !== 'Online' && ev.mode !== 'Hybrid') return false;
        else if (location !== 'Online' && ev.city !== location) return false;
      }
      if (participation !== 'all' && ev.participationType !== participation) return false;
      if (q) {
        const haystack = [
          ev.name,
          ev.tagline,
          ev.organizer,
          ev.institution,
          ev.city,
          ev.location,
          ev.categoryLabel
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => new Date(a.startTimeISO || 0) - new Date(b.startTimeISO || 0));
    }

    return list;
  }

  return {
    STATUS_META,
    ROUND_TYPES,
    QUALIFICATION_MODES,
    REGISTRATION_STATUSES,
    TEAM_STATUSES,
    CUSTOM_FIELD_TYPES,
    LIVE_EVENT_STATUSES,
    LIVE_ROUND_STATUSES,
    LIVE_TIMER_STATES,
    LIVE_PARTICIPATION_STATUSES,
    ANNOUNCEMENT_TEMPLATES,
    CONTENT_STATUSES,
    PDF_CATEGORIES,
    CONTENT_AVAILABILITY_MODES,
    QUESTION_TYPES,
    DIFFICULTY_LEVELS,
    MATERIAL_CATEGORIES,
    CODING_LANGUAGES,
    ATTACHMENT_CATEGORIES,
    MAX_PDF_BYTES,
    MAX_ATTACHMENT_BYTES,
    EVALUATION_STATUSES,
    QUALIFICATION_STRATEGIES,
    TIE_BREAKER_MODES,
    OVERALL_SCORING_MODES,
    MULTI_ANSWER_SCORING_RULES,
    getCategories,
    getRoundTypeCatalog,
    getRoundTypeMeta,
    createBlankRound,
    normalizeRound,
    deepCloneRounds,
    formatQualificationSummary,
    formatScheduleDisplay,
    getRoundHighlights,
    normalizeTeamConfig,
    getDefaultFormFields,
    normalizeRegistrationConfig,
    getParticipantStats,
    getTeamStats,
    getActiveRegistrationCount,
    evaluateRegistrationAvailability,
    isCancellationAllowedNow,
    validateRegistrationSubmission,
    saveRegistrationConfig,
    saveRegistrationFormFields,
    submitEventRegistration,
    updateUserRegistration,
    cancelUserRegistration,
    getUserRegistrations,
    getUserTeams,
    participantCreateTeam,
    participantJoinTeamById,
    participantLeaveTeam,
    getAllEvents,
    getOrganizerEvents,
    getFeaturedEvents,
    getEventBySlug,
    filterEvents,
    savePreviewEvent,
    updateEvent,
    saveEventRounds,
    saveTeamRules,
    updateParticipantStatus,
    createTeam,
    updateTeam,
    deleteTeam,
    assignMembersToTeam,
    removeMemberFromTeam,
    setTeamLeader,
    loadDemoRoster,
    clearDemoRoster,
    duplicateEvent,
    deleteEvent,
    restoreSampleEvents,
    getDashboardStats,
    getCollaborators,
    addCollaborator,
    removeCollaborator,
    getRecentActivity,
    logActivity,
    parseDurationToSeconds,
    computeTimerSnapshot,
    normalizeLiveOps,
    syncExpiredRoundTimers,
    getLiveOperationsSnapshot,
    setLiveConcurrentMode,
    startLiveEvent,
    pauseLiveEvent,
    resumeLiveEvent,
    completeLiveEvent,
    reopenLiveEvent,
    startLiveRound,
    pauseLiveRound,
    resumeLiveRound,
    endLiveRound,
    completeLiveRound,
    advanceToNextRound,
    extendRoundTimer,
    updateLiveParticipantStatus,
    updateLiveTeamStatus,
    syncPresentationQueue,
    createAnnouncement,
    updateAnnouncement,
    publishAnnouncement,
    deleteAnnouncement,
    validatePdfDescriptor,
    getRoundContentSummary,
    getRoundContentPackage,
    saveRoundContentMeta,
    addRoundPdf,
    replaceRoundPdf,
    updateRoundPdfMeta,
    removeRoundPdf,
    addRoundQuestion,
    updateRoundQuestion,
    duplicateRoundQuestion,
    deleteRoundQuestion,
    reorderRoundQuestions,
    buildSampleQuestionsCsv,
    parseQuestionImportText,
    importRoundQuestions,
    addCodingProblem,
    updateCodingProblem,
    duplicateCodingProblem,
    reorderCodingProblems,
    deleteCodingProblem,
    addRoundAttachment,
    removeRoundAttachment,
    addRoundMaterial,
    deleteRoundMaterial,
    evaluateRoundContentAccess,
    getParticipantRoundContent,
    getParticipantRoundPortalSnapshot,
    buildTargetKey,
    resolveRoundTargets,
    recordRoundSubmission,
    saveRoundRubric,
    addRubricCriterion,
    updateRubricCriterion,
    deleteRubricCriterion,
    reorderRubricCriteria,
    saveEvaluationScore,
    reopenEvaluation,
    evaluateSingleMcqQuestion,
    autoEvaluateRoundMcq,
    recalculateRoundMcqScores,
    computeRoundStandings,
    saveQualificationConfig,
    saveTieBreakerConfig,
    computeQualificationPreview,
    finalizeRoundQualification,
    reopenRoundQualification,
    progressQualifiedToNextRound,
    validateOverallWeights,
    saveOverallScoringConfig,
    computeOverallLeaderboard,
    publishRoundResults,
    publishOverallResults,
    getPublishedEventResults,
    buildResultsCsv,
    setBackendMode,
    getBackendMode,
    setSyncListener,
    replaceRemoteCatalog,
    upsertRemoteEvent,
    removeRemoteEvent,
    getLocalPrototypeSnapshot
  };
})();
