// Hand-authored dialogue content bank for the 5 crew of The Long Silence.
// Source material (backstory, faction leaning, voice notes) is CREW.md —
// this file turns that into fragments the engine in dialogue.js combines
// with mood (relationship), room/activity context, and history to produce
// varied output without literally writing out every possible line.
//
// Per crew member: ~70 hand-written fragments across greetings, three
// topics (ship/player/backstory), four "ask about <other crew>" banks,
// and idle flavor — each split across up to 3 relationship moods
// (cool/neutral/warm). The engine's job is to make ~350 authored lines
// feel like a much larger, non-repetitive conversation.

export const CREW_DIALOGUE = {
  dessa: {
    name: "Dessa Okafor",
    role: "Captain",
    room: "Common Area",
    greetingFirstMeeting: [
      "You're the new hire everyone's been talking about. Try not to break anything expensive.",
      "So you're still breathing. Good start. Most people who wander my ship uninvited aren't.",
    ],
    greetingReturning: {
      neutral: [
        "Back again. Door's always open, mostly because we can't afford a lock that works.",
        "What now.",
        "You again. Ship's not on fire, so I've got a minute.",
      ],
      warm: [
        "Hey. Pull up a crate, there's coffee if Corwin hasn't hoarded it.",
        "Good timing. I could use a face that isn't scowling at me for once.",
        "You're becoming a fixture around here. Could be worse company.",
      ],
      cool: [
        "What do you want.",
        "Make it quick, I've got a manifest that's lying to me.",
        "You again. Try not to waste my time this time.",
      ],
    },
    topics: {
      ship: {
        neutral: [
          "She's eleven years of patched hull and spite. Runs on the second thing more than the first some weeks.",
          "The Long Silence isn't much to look at. She's mine, though, free and clear, and that's worth more than looks.",
          "Ask Corwin about the ship if you want the truth. I'll just tell you she's fine and hope I'm right.",
        ],
        warm: [
          "She's a good ship. Ugly as sin, but she's never once let me down when it counted.",
          "I've turned down better offers than this ship more times than I can count. Never regretted it.",
          "You want to know a secret? I talk to her sometimes. Don't tell Corwin, he'll think I'm encroaching.",
        ],
        cool: [
          "She flies. That's the extent of what you need to know.",
          "Ask someone who wants to chat about it.",
          "She's a ship. I don't have the energy for sentiment right now.",
        ],
      },
      player: {
        neutral: [
          "Jury's still out on you. Ask me again once you've earned an opinion.",
          "You do your job, don't get anyone killed, we'll get along fine.",
          "I don't waste time disliking people before they've given me a reason. Working on the jury.",
        ],
        warm: [
          "You've pulled your weight. That counts for a lot on a ship this small.",
          "I was wrong to size you up as dead weight. Don't let it go to your head.",
          "You're alright. Don't tell the others I said that.",
        ],
        cool: [
          "You're testing my patience, and I don't have much left over most days.",
          "I've had worse crew. That's not a compliment, just a fact.",
          "Watch yourself. I notice things.",
        ],
      },
      backstory: {
        neutral: [
          "I grew up Compact, walked away from it, bought this ship with a forged credential and a lot of nerve. That's the short version.",
          "Everyone on this ship has a reason to hate somebody. Mine's complicated. Leave it there.",
          "I've done jobs for all three factions. None of them get to call me loyal.",
        ],
        warm: [
          "There was a run that went bad, cost another crew everything. I still think about it. Don't ask which one.",
          "I owe a Ridgeline quartermaster a debt I haven't settled. Feels strange, telling you that.",
          "Compact arcologies teach you to file paperwork and swallow your opinions. I got good at the first part and gave up on the second.",
        ],
        cool: [
          "Not everything's your business.",
          "I don't hand out my history to just anybody.",
          "Ask me something that isn't about my past.",
        ],
      },
      about_kaia: {
        neutral: [
          "Best pilot I've ever flown with. I don't ask about Ridgeline. She'll tell me if she wants to.",
          "She still flies like someone's grading her. I've stopped trying to talk her out of it.",
        ],
        warm: [
          "Kaia's earned more trust from me than she thinks. Don't tell her, she'll get formal about it.",
          "She refused an order that would've made her a murderer. That tells you everything you need to know about her.",
        ],
        cool: [
          "Kaia does her job. I don't pry past that.",
          "Ask her yourself. Not my story to tell.",
        ],
      },
      about_corwin: {
        neutral: [
          "Corwin thinks every deal I make is a small betrayal. He's not always wrong.",
          "Best engineer I've had. Also the most likely to lecture me about the Drift over breakfast.",
        ],
        warm: [
          "He keeps this ship alive more than I do. I don't say that enough.",
          "Corwin's anger comes from caring too much. I'd rather have that than someone who doesn't.",
        ],
        cool: [
          "Corwin and I don't always see eye to eye. That's the arrangement.",
          "Ask him. He'll have opinions.",
        ],
      },
      about_amara: {
        neutral: [
          "Amara's the closest thing this crew has to a conscience. Useful, occasionally inconvenient.",
          "She doesn't yell. She just states facts until you feel bad enough to do the right thing.",
        ],
        warm: [
          "I trust her judgment more than my own, some days.",
          "Amara's the reason this crew hasn't turned into a pack of scavengers with worse manners.",
        ],
        cool: [
          "Amara has opinions about how I run this ship. Noted, filed, occasionally ignored.",
          "Talk to her about it. I've got a manifest to lie to me about.",
        ],
      },
      about_marcus: {
        neutral: [
          "Marcus does his job well and doesn't ask for much. I don't ask for more than that.",
          "I don't know his whole story. I know he's useful. For now that's enough.",
        ],
        warm: [
          "I'd trust Marcus with my back in a fight. Whatever he's not telling me, I'll take that chance.",
          "He's earned more slack from me than his file would suggest he deserves.",
        ],
        cool: [
          "Marcus keeps secrets. So do I. We understand each other.",
          "I'm watching him. Same as I watch everyone who doesn't explain themselves.",
        ],
      },
    },
    idle: {
      working: [
        "Dessa's hunched over a data slate, muttering at a manifest that isn't adding up.",
        "She's cross-referencing cargo weights against a fuel budget that keeps losing the argument.",
        "Dessa's on a comm channel with someone, voice flat, negotiating something she'd rather not be negotiating.",
      ],
      idle: [
        "Dessa's got her boots up on the table, eyes closed, pretending she's not listening to everything around her.",
        "She's nursing a mug of something that stopped being coffee three refills ago.",
        "Dessa's staring at the middle distance in that way that means she's doing math on money she doesn't have.",
      ],
      walking: [
        "Dessa paces a slow loop through the common area, the way she does when a decision's still unmade.",
        "She's checking the room like she's counting heads, out of habit more than need.",
        "Dessa moves through unhurried, the captain's version of a fire drill: calm on the outside.",
      ],
    },
    relationshipChoice: {
      prompt: "She mentions the debt she still owes a Ridgeline quartermaster, half to herself.",
      options: [
        {
          id: "pragmatic",
          label: '"Whatever keeps the ship flying. Pay it when you can."',
          delta: 1,
          response: '"Exactly right. You might survive out here after all." She almost smiles.',
        },
        {
          id: "moralize",
          label: '"You should just settle it and be done with it."',
          delta: -1,
          response: '"That easy, is it." She goes back to her slate like the conversation\'s over. It is.',
        },
      ],
    },
  },

  kaia: {
    name: "Kaia Brenn",
    role: "Pilot",
    room: "Cockpit",
    greetingFirstMeeting: [
      "Kaia Brenn. Pilot. You're the new crew — noted. Try to stay out of the cockpit during approach.",
      "Copy the introduction. I'm Kaia. I fly this thing. Questions later, I've got a preflight to finish.",
    ],
    greetingReturning: {
      neutral: ["Status check?", "You need something, or is this a social call. I can do either, badly.", "Go ahead. I'm between checklists."],
      warm: [
        "Good timing. Nothing's on fire, which around here counts as a good day.",
        "You. Good. I was starting to think I'd have to talk to myself again.",
        "At ease. Figuratively. Sit if you want.",
      ],
      cool: ["What do you need.", "Make it brief.", "I've got a preflight running. This better be quick."],
    },
    topics: {
      ship: {
        neutral: [
          "Handles like a brick with opinions. I compensate. She's never let me down when it mattered.",
          "Structurally she's sound. Cosmetically she's an argument for scrap. I fly her anyway.",
          "Ask Corwin for specs. I just know how she moves, and she moves fine.",
        ],
        warm: [
          "First ship I've flown where nobody's grading me on the landing. Took me a while to trust that.",
          "She's not regulation anything. I like that more than I expected to.",
          "I trust the Captain's flying more than I trust most people's politics. This ship earns that.",
        ],
        cool: ["She flies. That's the assessment.", "Ask someone with time for small talk about hardware.", "Fine. Same as last time you asked."],
      },
      player: {
        neutral: [
          "You follow instructions well enough. I don't have a rating system beyond that yet.",
          "No incident reports with your name on them so far. That's a compliment, from me.",
          "Still assessing. I'll let you know if that changes.",
        ],
        warm: [
          "You've got good instincts. I don't say that about people easily.",
          "I'd fly you into a hot zone without flinching. That's the highest rating I hand out.",
          "You're solid. Copy that and don't let it go to your head.",
        ],
        cool: [
          "You're on my list of things to keep an eye on. Not a good list.",
          "I don't have a lot of patience left for unpredictable people.",
          "Careful. I notice patterns, and I don't like the one you're making.",
        ],
      },
      backstory: {
        neutral: [
          "I flew for the Ridgeline Authority. Nine years. I don't talk about the tenth.",
          "I was good at my job. Good enough that leaving it cost me everything but the ship I was flying.",
          "Court-martialed in absentia. Means they tried me without me there to argue. Efficient, at least.",
        ],
        warm: [
          "They ordered me to fire on a transport. Turned out to be evacuees, not smugglers. I said no and ran.",
          "I still fly checklists nobody's grading. Habit's the only chain of command I've got left.",
          "Ridgeline made me good at my job. It didn't teach me what to do when the job stops making sense.",
        ],
        cool: ["Not a conversation I'm having right now.", "Ask something operational.", "Some things stay classified. Even to friendlies."],
      },
      about_dessa: {
        neutral: [
          "The Captain flies like she's got nothing to lose. Turns out that's usually true.",
          "I trust her stick-and-rudder skills completely. Her politics, less so. She doesn't ask me to agree with her.",
        ],
        warm: [
          "She never asked about Ridgeline. Not once. I owe her more for that than for the job.",
          "Best pilot I've flown alongside who wasn't in a Ridgeline cockpit. That's saying something.",
        ],
        cool: ["The Captain and I have an understanding. It doesn't require warmth.", "Ask her yourself. I don't speak for the Captain."],
      },
      about_corwin: {
        neutral: [
          "Corwin keeps this ship in the air. I respect competence regardless of politics.",
          "He's got opinions about the Drift he doesn't hide. Fine by me, at least he's honest about them.",
        ],
        warm: [
          "Corwin's the reason I stopped worrying about engine failure mid-flight. That's rare, coming from me.",
          "He doesn't trust easy. Neither do I. We get along fine on that basis.",
        ],
        cool: ["Corwin and I keep it professional. Works for both of us.", "Talk to him about the ship. I talk to him about the ship. That's the relationship."],
      },
      about_amara: {
        neutral: [
          "Amara patches me up without the lecture most medics give a defector. I appreciate the restraint.",
          "She asks good questions. Doesn't push past where I stop answering.",
        ],
        warm: [
          "Amara's the only one who ever asked how I was doing and meant it operationally, not emotionally. I prefer that.",
          "If I go down, I want her in the room. No qualifiers on that.",
        ],
        cool: ["Amara does her job well. I don't have more to add.", "Ask her about it. Not my department."],
      },
      about_marcus: {
        neutral: [
          "Marcus reads former military. I don't ask which branch. I know better than most what that question costs.",
          "He's competent. That's the assessment I'm sticking with.",
        ],
        warm: [
          "I don't push him on his past. Some habits of discretion I understand better than most.",
          "He's steady in a crisis. I trust that more than a clean service record.",
        ],
        cool: [
          "Something about him reads Ridgeline brass. I don't like what that does to my hands.",
          "I keep my distance. Old instinct. Don't take it personally, or do, I don't control that.",
        ],
      },
    },
    idle: {
      working: [
        "Kaia's running through a preflight checklist out loud, to no one, out of habit.",
        "She's got both hands on the console, eyes on a diagnostic readout that isn't cooperating.",
        "Kaia's recalibrating the nav array, movements precise, like someone's timing her.",
      ],
      idle: [
        "Kaia's in the pilot's seat, not flying, just sitting the way soldiers sit when there's nowhere else assigned to be.",
        "She's staring at the stars through the viewport, expression unreadable.",
        "Kaia's cleaning a piece of gear that's already clean. Her hands need a job even when she doesn't.",
      ],
      walking: [
        "Kaia does a slow perimeter check of the cockpit controls, the kind of walk that's really an inspection.",
        "She moves with the clipped efficiency of someone used to being watched.",
        "Kaia's pacing the length of the cockpit, counting steps like it's a runway.",
      ],
    },
    relationshipChoice: {
      prompt: "She mentions, flatly, the order she refused — the one that ended her Ridgeline career.",
      options: [
        {
          id: "validate",
          label: '"You made the right call. That\'s not nothing."',
          delta: 1,
          response: 'She\'s quiet for a second too long. "Copy that." It\'s the closest thing to thank you she\'s got.',
        },
        {
          id: "orders",
          label: '"A soldier\'s job is to follow orders, not question them."',
          delta: -1,
          response: 'Her jaw tightens. "Copy." One word, ice cold. She turns back to the console.',
        },
      ],
    },
  },

  corwin: {
    name: "Corwin Talus",
    role: "Engineer",
    room: "Engine Room",
    greetingFirstMeeting: [
      "You're the new one. Don't touch the coolant manifold, it bites.",
      "Corwin. Engineer. If something breaks and it's not my fault, come find me anyway, I'll still fix it.",
    ],
    greetingReturning: {
      neutral: ["Yeah?", "Give me a second, this line's not sealing right— okay. What.", "You need something or you just like the smell of grease."],
      warm: [
        "Hey. Grab a wrench if you're bored, always more to do than hands to do it.",
        "Good, you're here. I found something in the aft coupling you'd probably think is interesting.",
        "You're alright to have around. Doesn't happen with everyone who walks through that door.",
      ],
      cool: ["What do you want.", "Kind of busy. Make it fast.", "Yeah, what."],
    },
    topics: {
      ship: {
        neutral: [
          "She's held together by good wiring and my personal grudge against entropy. Mostly holding.",
          "Every seam on this ship, I know it better than my own family's station. That's not nothing to me.",
          "Coolant line's temperamental, aft thruster's got a shimmy I haven't traced, and the reactor's fine, probably.",
        ],
        warm: [
          "This ship's the closest thing I've got to home turf. I'd die for her before I'd die for most people.",
          "I talk to her sometimes when I'm elbow-deep in a panel. Don't tell the Captain, she'd make it weird.",
          "You want to see something good, come by when I've got the reactor casing open. She's beautiful when she's honest with you.",
        ],
        cool: ["She flies. Ask me again when you've got a real question.", "Busy. Ship talk later.", "Fine. Same as she's been."],
      },
      player: {
        neutral: [
          "You haven't broken anything yet. Low bar, but you're clearing it.",
          "Jury's out. I don't warm up fast, don't take it personal.",
          "Ask me again once you've helped me fix something. That's how I score people.",
        ],
        warm: [
          "You've been alright. I don't say that to just anybody who walks through here.",
          "You're good in a pinch. I noticed. I notice things like that.",
          "You've earned some trust. Don't waste it running Compact errands without asking me first.",
        ],
        cool: [
          "You keep taking jobs I don't like the smell of. Noted.",
          "I don't trust easy, and you're not making it easier.",
          "Watch which errands you run for who. I'm watching too.",
        ],
      },
      backstory: {
        neutral: [
          "Grew up on a Belt mining station. Learned to fix things before I learned to read. Priorities.",
          "The Compact taxed my family's station into the ground years back. I don't forget things like that.",
          "The Drift's not a flag I wave, it's just the only side that's ever actually looked out for people like mine.",
        ],
        warm: [
          "This ship's the closest thing to home I've had since the station went under. That's why I fight for her.",
          "I trust the Captain's skill. Her deal-making with Compact and Ridgeline, that's a harder sell for me.",
          "Every compromise she makes, I feel it like a splinter. Doesn't mean I'll ever leave. Just means I'll complain.",
        ],
        cool: ["Not really in the mood to get into it.", "That's mine, not yours. Ask about the ship instead.", "Some other time."],
      },
      about_dessa: {
        neutral: [
          "The Captain's good at what she does. I just don't love who she does it for sometimes.",
          "Every deal she cuts with Compact or Ridgeline costs the Drift something. She knows it. Doesn't stop her.",
        ],
        warm: [
          "She's kept this ship — and this crew — alive longer than anyone had a right to expect. I'll give her that.",
          "I trust her more than I let on. Doesn't mean I'll stop pushing back when she cuts corners.",
        ],
        cool: ["The Captain and I don't agree on much past keeping the ship flying.", "Ask her about her deals. I've got opinions I'm not in the mood to share."],
      },
      about_kaia: {
        neutral: ["Ex-Ridgeline. Doesn't advertise it, doesn't need to, it's in how she stands.", "She's sharp. Keeps to herself. I respect people who let their work talk."],
        warm: [
          "She refused an order that would've made her a killer. That buys a lot of trust with me, Ridgeline past or not.",
          "Best pilot I've flown with. I don't say that about ex-Authority people easily.",
        ],
        cool: ["Ridgeline trained her. I keep half an eye on that fact. Old habit.", "We keep it professional. Suits us both."],
      },
      about_amara: {
        neutral: [
          "Amara's the one who actually checks whether a decision hurts people before we make it. Rare quality.",
          "She's Compact-born but she left because of what it did to people like my family. I respect that a lot.",
        ],
        warm: [
          "Amara and I don't always agree on tactics, but we want the same thing. That's more than I can say for most.",
          "She's the moral compass on this ship, whether she wants the job or not. I'm glad someone's got it.",
        ],
        cool: ["Amara's fine. Talk to her, she'll give you the honest version.", "Not really the topic I want right now."],
      },
      about_marcus: {
        neutral: ["Marcus doesn't talk about his past. I used to ask. Stopped.", "He's Ridgeline-shaped in a way that doesn't quite add up. Draw your own conclusions."],
        warm: [
          "He's solid in a fight, and he's never once turned that on us. That buys real trust, mysterious past or not.",
          "I've stopped needing the whole story to trust a guy. Marcus earned that the hard way, over time.",
        ],
        cool: ["Unexplained absences, comms he won't discuss. I notice. I just don't push.", "Ask him yourself. He won't tell you either, but at least it's not secondhand."],
      },
    },
    idle: {
      working: [
        "Corwin's elbow-deep in a conduit panel, muttering at a connector that won't seat right.",
        "He's got three tools in his hands at once and a fourth in his teeth, mid-repair.",
        "Corwin's tracing a wiring diagram with one grease-streaked finger, cursing softly at whoever ran this line originally.",
      ],
      idle: [
        "Corwin's got his boots up, reading a maintenance manual for fun, which is either dedication or a warning sign.",
        "He's off the clock, nursing a drink, telling a story about a coolant leak that's grown taller with each telling.",
        "Corwin's tinkering with a spare part that doesn't belong to anything, just to keep his hands busy.",
      ],
      walking: [
        "Corwin's doing his rounds, running a palm along the wall like he's checking the ship's pulse.",
        "He's walking the length of the corridor listening for a sound only he seems to hear.",
        "Corwin moves through with a toolkit slung over one shoulder, already headed toward the next problem.",
      ],
    },
    relationshipChoice: {
      prompt: "He's venting, again, about the Captain's willingness to cut deals with Compact and Ridgeline.",
      options: [
        {
          id: "support_drift",
          label: '"You\'re right to keep her honest about it."',
          delta: 1,
          response: 'He nods, some of the tension going out of his shoulders. "Good. Somebody besides me should say it out loud."',
        },
        {
          id: "defend_dessa",
          label: '"The Drift needs those compromises too, whether you like it or not."',
          delta: -1,
          response: 'His jaw sets. "Yeah. Everyone says that right up until it\'s their station that pays for it." He goes back to the panel.',
        },
      ],
    },
  },

  amara: {
    name: "Amara Voss",
    role: "Medic/Quartermaster",
    room: "Cargo Bay",
    greetingFirstMeeting: [
      "You must be the new crew. I'm Amara — medic, and I keep track of what's actually on this ship. Let me know if anything hurts.",
      "Welcome aboard. I'd ask how you're settling in, but I already know the answer's 'still figuring it out.' Everyone's is.",
    ],
    greetingReturning: {
      neutral: ["How are you finding things so far?", "Come in. What's on your mind?", "I've got a minute, if you need one."],
      warm: ["There you are. I was hoping you'd stop by.", "Good to see you. Sit, if you'd like — I could use the company.", "I was just thinking about something you said last time. Come in."],
      cool: ["What can I do for you.", "Go ahead.", "I'm listening."],
    },
    topics: {
      ship: {
        neutral: [
          "I keep inventory of everything aboard, down to the last bandage. Someone has to know what we actually have.",
          "This ship carries more than cargo. It carries what's left of five people's choices. I try to keep both accounted for.",
          "We're low on a few things I'd rather not be low on. I'm working on it.",
        ],
        warm: [
          "I've come to think of this ship as the first honest place I've lived since I left Earth. That's worth something.",
          "I keep a little garden of medicinal herbs in the corner of the cargo bay. Small thing. Keeps me sane.",
          "This crew looks out for each other more than any Compact block ever did for mine. I notice things like that.",
        ],
        cool: ["The ship is fine. I'd rather not get into it right now.", "Ask someone else, I'm a little tired today.", "It's fine."],
      },
      player: {
        neutral: [
          "You're settling in well, I think. Is there anything you need that you haven't asked for?",
          "I don't have a read on you yet, not fully. I'd like to, when you're ready.",
          "How are you doing, honestly? Not the version you tell the Captain.",
        ],
        warm: [
          "You've been kind, in the small ways that actually matter. I notice those.",
          "I trust you more than I expected to, this early. That's not nothing, coming from me.",
          "You ask good questions. Most people on this ship stopped asking a long time ago.",
        ],
        cool: ["I've noticed some choices I'm not sure about. I won't pretend otherwise.", "I'd rather not say, right now.", "Ask me again another time."],
      },
      backstory: {
        neutral: [
          "I left Earth after my family's block lost its water allocation. An administrative decision. Nobody's fault, everyone's problem.",
          "I trained as a field medic before I left. Now I do that and quartermaster work, because someone has to track what we have with a conscience attached.",
          "I don't talk about the Compact with much anger. I don't need to. The facts do that on their own.",
        ],
        warm: [
          "The reclassification that cost my family everything took eleven minutes of some clerk's afternoon. I think about that a lot.",
          "I don't lecture the crew about what's right. I just tell them who a decision affects, and let them sit with it.",
          "I'm quietly political, if that's not a contradiction. I'd rather change minds slowly than shout and change nothing.",
        ],
        cool: ["Not today, if that's alright.", "Some things I'd rather keep to myself right now.", "Ask me something easier."],
      },
      about_dessa: {
        neutral: [
          "The Captain and I don't always agree on what a job's worth. I keep telling her who pays the difference.",
          "She listens to me more than she lets on. I've learned to be patient about it.",
        ],
        warm: [
          "She's taken my advice more than once when it cost her something to do it. I respect that more than she knows.",
          "Underneath the deflecting, she cares more than she'll admit. I've made peace with only getting to see it sideways.",
        ],
        cool: ["The Captain and I are working through a disagreement. It'll settle.", "Ask her about it. I'd rather not speak for her."],
      },
      about_kaia: {
        neutral: [
          "Kaia doesn't ask for sympathy, so I don't offer it directly. I just make sure she knows the door's open.",
          "She's carrying more than she shows. I recognize the type. I used to be one.",
        ],
        warm: [
          "She let her guard down with me once, just for a second. I think about that more than she'd like.",
          "Kaia's discipline isn't coldness, it's how she survived. I respect that distinction.",
        ],
        cool: ["Kaia keeps to herself. I respect the boundary.", "Not much to add there right now."],
      },
      about_corwin: {
        neutral: [
          "Corwin loves this ship the way some people love a person. I find it genuinely moving, even when he's shouting about coolant.",
          "He's suspicious of Compact errands, and honestly, he's not wrong to be.",
        ],
        warm: [
          "Corwin and I want the same things for different reasons. That's the best kind of ally to have.",
          "He'd give someone his last tool before his last meal. I trust people like that.",
        ],
        cool: ["Corwin's fine. We're a little at odds on one thing right now.", "Ask him yourself, I'd rather not summarize him unfairly."],
      },
      about_marcus: {
        neutral: [
          "Marcus doesn't talk about himself. I don't push. Everyone's allowed a door they don't open.",
          "Whatever he's not saying, it hasn't shown up in how he treats this crew. That matters more to me than his file.",
        ],
        warm: [
          "I patched him up once without asking questions. I think that bought me more trust than anything I've said since.",
          "He's careful with people in a way that tells me he's been hurt by someone who wasn't. I don't need the details to see that.",
        ],
        cool: ["Marcus keeps his distance. I let him.", "I'd rather not speculate about him right now."],
      },
    },
    idle: {
      working: [
        "Amara's counting bandages against a list, lips moving silently through the tally.",
        "She's repackaging a crate of medical supplies, careful and unhurried.",
        "Amara's cross-checking the cargo manifest against what's actually on the shelves, frowning at a discrepancy.",
      ],
      idle: [
        "Amara's tending a small tray of herbs tucked in the corner of the cargo bay, humming something under her breath.",
        "She's sitting quietly with a data slate, not really reading it.",
        "Amara's cleaning instruments that are already clean, the way people do when their hands need something to do.",
      ],
      walking: [
        "Amara moves through the cargo bay checking crate seals, methodical, unhurried.",
        "She's doing a slow walkthrough, the kind that's really her checking on everyone without seeming to.",
        "Amara paces with a data slate tucked under one arm, updating inventory as she goes.",
      ],
    },
    relationshipChoice: {
      prompt: "She's quietly turning over a decision — sell the surplus painkillers, or give them to Ceres Station, which needs them more.",
      options: [
        {
          id: "give",
          label: '"Give them to Ceres Station. We\'ll manage without the money."',
          delta: 1,
          response: 'Something in her shoulders eases. "Thank you. I mean that." She starts drafting the transfer manifest.',
        },
        {
          id: "sell",
          label: '"Sell them. The ship needs the money more than they need the favor."',
          delta: -1,
          response: 'She\'s quiet for a moment. "Understood." She writes it down without looking up again.',
        },
      ],
    },
  },

  marcus: {
    name: "Marcus Reyn",
    role: "Security",
    room: "Common Area",
    greetingFirstMeeting: [
      "Marcus Reyn. Security. Stay out of trouble and we won't have much to talk about, which is how I like it.",
      "You're the new one. Noted. I keep an eye on everyone at first. Nothing personal.",
    ],
    greetingReturning: {
      neutral: ["Something you need?", "Go ahead.", "You've got my attention. Briefly."],
      warm: ["Good to see you. Quiet shift, for once.", "Come in. I don't mind the company today.", "You. Good timing, actually."],
      cool: ["What.", "Make it quick.", "I'm working. What do you need."],
    },
    topics: {
      ship: {
        neutral: [
          "Ship's secure. That's my only real concern about her.",
          "I do a sweep twice a shift. Nothing's tried anything interesting lately.",
          "Ask the engineer about her bones. I only care about her doors and who's behind them.",
        ],
        warm: [
          "This ship's the first place in a while I've stopped watching my own exits quite so hard. Small thing. Matters.",
          "I like this crew. Don't tell them I said that.",
          "It's a decent ship. Better company than most I've kept.",
        ],
        cool: ["Ship's fine. That's all you need.", "Ask someone with time for the tour.", "Fine."],
      },
      player: {
        neutral: [
          "You're fine. I'd tell you if you weren't.",
          "Still reading you. Ask me again sometime.",
          "No complaints yet. That's higher praise than it sounds.",
        ],
        warm: [
          "You're solid. I don't say that about people quickly.",
          "I'd back you in a fight. That's not a small thing, coming from me.",
          "You've earned some trust. Don't make me regret saying that out loud.",
        ],
        cool: [
          "I'm keeping half an eye on you. Nothing personal. Or maybe a little personal.",
          "Ask me something I'll actually answer.",
          "Not now.",
        ],
      },
      backstory: {
        neutral: [
          "Ask me something I'll actually answer.",
          "Ex-something. That's as far as that conversation goes today.",
          "I took this job for reasons that are mine. That's the whole answer.",
        ],
        warm: [
          "I carry myself like Ridgeline muscle. The timeline doesn't quite add up if you look close. I know.",
          "I get comms sometimes I don't discuss. I know how that looks. I'm not going to explain it yet.",
          "Someday I might tell you the whole thing. Today isn't that day. Appreciate you not pushing.",
        ],
        cool: ["No.", "That door's staying shut.", "Ask about something else."],
      },
      about_dessa: {
        neutral: [
          "The Captain runs a tight ship without pretending it's clean. I respect the honesty in that.",
          "She doesn't ask about my past. I don't ask about her debts. Works out fine.",
        ],
        warm: [
          "She's given me more trust than my file probably earns. I try to be worth it.",
          "Best captain I've served under, and that's including people who outranked her on paper.",
        ],
        cool: ["The Captain and I keep things professional.", "Ask her. I don't speak for the Captain."],
      },
      about_kaia: {
        neutral: [
          "Brenn keeps her head under pressure. I respect that more than a clean record.",
          "She reads Ridgeline the way I probably read something else to her. We both keep our distance. It's mutual and it's fine.",
        ],
        warm: [
          "She's steady. In this line of work, steady's worth more than friendly.",
          "I don't push her about her past. She returns the favor. Good arrangement.",
        ],
        cool: ["Not much to say. We keep it professional.", "Ask her yourself."],
      },
      about_corwin: {
        neutral: ["Corwin used to ask about my past. Stopped a while back. I appreciated that more than I said.", "He's suspicious of me. Fair. I'd be too."],
        warm: [
          "Corwin trusts me with the ship's safety even without the whole story. That's not a small thing for a guy like him.",
          "He's the most honest person on this crew, in his own prickly way. I respect it.",
        ],
        cool: ["Corwin and I don't talk much. That's fine by both of us.", "Ask him. I won't fill in the gaps."],
      },
      about_amara: {
        neutral: ["Amara patched me up once without a single question. I don't forget things like that.", "She's the conscience on this ship. Every crew needs one. Ours got lucky."],
        warm: [
          "Amara's the one person here who never made me feel like a suspect. That's worth more than she knows.",
          "If something ever happens to me, she's the one I'd want in the room. No question.",
        ],
        cool: ["Amara's fine. Good at her job.", "Ask her yourself. Not much to add."],
      },
    },
    idle: {
      working: [
        "Marcus is doing a slow sweep of the room, eyes moving even when the rest of him looks relaxed.",
        "He's checking the door seals for the third time this shift, out of habit more than concern.",
        "Marcus is running an inventory check on the ship's small arms locker, quiet and methodical.",
      ],
      idle: [
        "Marcus is sitting with his back to the wall, the way people do when they've learned the hard way to watch the door.",
        "He's cleaning a sidearm that's already clean, hands busy, face unreadable.",
        "Marcus is reading something on a data slate, angled so no one else can see the screen.",
      ],
      walking: [
        "Marcus walks the ship's perimeter, unhurried, checking every hatch without seeming to.",
        "He moves quiet for someone his size, always aware of where the exits are.",
        "Marcus is doing rounds, nodding at whoever he passes, saying nothing more than he has to.",
      ],
    },
    relationshipChoice: {
      prompt: "You could press him about the unexplained absences and comms he won't discuss.",
      options: [
        {
          id: "trust",
          label: '"I trust you. Your business is your business."',
          delta: 1,
          response: 'Something in his posture loosens, just slightly. "...Thanks. Means more than you\'d guess."',
        },
        {
          id: "press",
          label: '"I need to know who\'s actually on this ship."',
          delta: -1,
          response: 'His expression goes flat and polite. "Fair question." He doesn\'t answer it. He never does.',
        },
      ],
    },
  },
};
