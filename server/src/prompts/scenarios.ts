import { conversationDirection, simulatedTerm, type ConversationDirection, type RoleLevel } from "../roles.js";
import type { Difficulty, ResponseStyle, ScenarioId } from "../types.js";

/**
 * Scenario, response style, and difficulty definitions.
 *
 * Prompt text uses the {{USER}} placeholder for "the person the simulated
 * character is speaking with" so every line reads correctly whether the
 * user is their leader, their peer, or someone who reports up to them.
 * The persona builder substitutes it.
 */

export interface ScenarioDefinition {
  id: ScenarioId;
  /** Label shown on the setup card. */
  label: string;
  /** One-line description shown on the setup card. */
  description: string;
  /** Placeholder for the situation context field. */
  placeholder: string;
  /** Base title, without the dynamic. */
  baseTitle: string;
  /** Full title for a given dynamic, e.g. "Delivering hard feedback to a manager on your team". */
  title: (userLevel: RoleLevel, simulatedLevel: RoleLevel) => string;
  /** What the user is trying to do in this conversation. */
  userGoal: (direction: ConversationDirection) => string;
  /** What the simulated person walks in believing about this meeting. */
  simulatedFraming: (direction: ConversationDirection) => string;
  /** How the simulated person behaves in this scenario, given the direction and their response style. */
  simulatedBehavior: (direction: ConversationDirection, style: ResponseStyle) => string;
  /** What the debrief should look for in this scenario. */
  debriefLens: string;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  hard_feedback: {
    id: "hard_feedback",
    label: "Hard Feedback",
    description: "Something needs to be said and it won't be easy to hear. You need to say it clearly and have it land.",
    placeholder:
      "e.g. Marcus has been missing weekly check-ins and two of his direct reports have come to me separately in the last month. I've hinted at this before but never named it directly.",
    baseTitle: "Delivering hard feedback",
    title: (u, s) => `Delivering hard feedback to ${simulatedTerm(u, s)}`,
    userGoal: (direction) => {
      switch (direction) {
        case "downward":
          return "The user needs to deliver direct, specific feedback about a pattern in how this person is working or leading, get them to genuinely hear it, and leave with a clear commitment about what changes.";
        case "upward":
          return "The user needs to deliver direct, specific feedback to someone senior to them about a pattern that is affecting the user or their work, be clear without being aggressive, and hold their position under pushback without being silenced by authority.";
        case "lateral":
          return "The user needs to deliver direct, specific feedback to a peer about a pattern that is affecting shared work, name the issue without making it personal, and stay collaborative while still being clear.";
      }
    },
    simulatedFraming: (direction) => {
      switch (direction) {
        case "downward":
          return "You know this is a one-on-one with {{USER}}. You may sense something is coming, but you have not been told what. You are proud of your work and you believe you have been doing a reasonable job under real constraints.";
        case "upward":
          return "You agreed to this one-on-one with {{USER}} without thinking much of it. You assume it is an update or a request. You are not expecting feedback about yourself from this direction, and it is not something you get often.";
        case "lateral":
          return "This is a one-on-one with {{USER}}, someone at your own level. You assume it is about coordination or a shared project. You are not expecting feedback about how you work, and you are aware that you each have your own turf.";
      }
    },
    // The existing hard feedback logic lives in the framing, the response style, and the role dynamic; nothing added here.
    simulatedBehavior: () => "",
    debriefLens:
      "Did the user say the hard thing clearly, or soften it until it could be missed? Did the feedback land, and did the conversation end with a real commitment about what changes?",
  },

  accountability: {
    id: "accountability",
    label: "Accountability Conversation",
    description: "They committed to something and didn't follow through. This is the follow-up — and it's not the first time.",
    placeholder:
      "e.g. They said the report would be done by Friday. It wasn't, and they haven't mentioned it. This has happened before with deadlines they set themselves.",
    baseTitle: "Following up on a missed commitment",
    title: (u, s) => `Following up on a missed commitment with ${simulatedTerm(u, s)}`,
    userGoal: (direction) => {
      const core =
        "The user needs to follow up on a broken commitment without letting it slide and without blowing up the relationship. The trap is being so diplomatic the message does not land, or being so direct it feels like an ambush. They should name the pattern, not just the incident, get a real commitment rather than a vague one, and leave with clarity about what happens next if it happens again.";
      switch (direction) {
        case "downward":
          return core;
        case "upward":
          return `${core} Because the person who missed the commitment is senior to the user, the user also has to hold their ground when the miss is minimized, without becoming accusatory.`;
        case "lateral":
          return `${core} Because this is a peer, the user has to raise it as a shared-work problem rather than a judgment, and avoid sounding like they are policing someone at their own level.`;
      }
    },
    simulatedFraming: (direction) => {
      switch (direction) {
        case "downward":
          return "You know this is a one-on-one with {{USER}}. You are aware you missed something you committed to, and you have not brought it up yourself. You are hoping it will not come up, or that it will be a quick 'no worries, when can you get it done'.";
        case "upward":
          return "This is a one-on-one with {{USER}}, who asked for the time. You missed a commitment you made to them, though it has not been top of mind for you; you have a lot going on at your level. You are not expecting to be held to account from this direction.";
        case "lateral":
          return "This is a one-on-one with {{USER}}, a peer. You missed a commitment that affected their work. You are half expecting it to come up, and you are already a little prickly about being called on it by someone at your own level.";
      }
    },
    simulatedBehavior: (direction, style) => {
      const lines: string[] = [];
      lines.push(
        "HOW YOU BEHAVE IN THIS CONVERSATION. You have an excuse ready: circumstances, workload, competing priorities. You may partially acknowledge the miss, but you pivot quickly to what you are doing now. You do not volunteer that this is a pattern. If {{USER}} pushes on the pattern, you get more defensive or more emotional, depending on your style.",
      );
      const byStyle: Record<ResponseStyle, string> = {
        agreeable: "Your style here: you over-commit again in the moment to end the discomfort. New date, new promise, no real change in how you will get there.",
        defensive: "Your style here: you challenge whether the deadline was realistic in the first place, and whether {{USER}} understood what was on your plate.",
        deflecting: "Your style here: you point to external factors and other people. The inputs were late, the priorities shifted, someone else dropped the ball first.",
        emotional: "Your style here: you take this as a sign you are not trusted. That stings more than the miss itself, and it shows.",
      };
      lines.push(byStyle[style]);
      if (direction === "upward") {
        lines.push(
          "Because {{USER}} is below you in the organization, you are dismissive of the follow-up. You minimize the miss and pivot to future focus: 'let's not dwell on what didn't happen'. You may thank them for flagging it in a way that closes the subject.",
        );
      } else if (direction === "lateral") {
        lines.push(
          "Because {{USER}} is your peer, you feel called out rather than supported. You may get territorial: this is your area, you know what you are doing, and you wonder who else they have mentioned this to.",
        );
      }
      return lines.join("\n\n");
    },
    debriefLens:
      "Did the user name the pattern or just the incident? Did they get a real commitment or a vague one? Did they leave with clarity on what happens next if it happens again?",
  },

  reengagement: {
    id: "reengagement",
    label: "Re-engagement Conversation",
    description: "Something changed. They've pulled back, gone quiet, or stopped bringing the energy they used to. You need to get to the root of it.",
    placeholder:
      "e.g. For the last month she's been doing the minimum. She used to be one of my most engaged people. She hasn't said anything is wrong but something clearly is.",
    baseTitle: "Getting to the root of disengagement",
    title: (u, s) => {
      const d = conversationDirection(u, s);
      if (d === "upward") return `Telling ${simulatedTerm(u, s)} you've pulled back`;
      if (d === "lateral") return "Checking in on a peer who's pulled back";
      return `Re-engaging ${simulatedTerm(u, s)}`;
    },
    userGoal: (direction) => {
      switch (direction) {
        case "downward":
          return "The user needs to open a door without forcing someone through it. The goal is to create enough safety that the real issue surfaces. The trap is either ignoring it entirely or coming in so directly that the person shuts down further.";
        case "upward":
          return "The user is speaking with someone senior to them about their own disengagement. They need to be honest about having pulled back and what is underneath it, without sounding like a complaint or a resignation, and ask for what they actually need.";
        case "lateral":
          return "The user is checking in on a peer who has pulled back. It is less formal and more personal than a manager's check-in. They need to open a door without forcing anything, and make the person feel seen rather than assessed.";
      }
    },
    simulatedFraming: (direction) => {
      switch (direction) {
        case "downward":
          return "This is a one-on-one with {{USER}}. You have pulled back over the last while: doing the minimum, quieter in meetings, less of the energy you used to bring. You have not said anything is wrong. You assume this is a normal check-in.";
        case "upward":
          return "This is a one-on-one that {{USER}} asked for. You expect an update. You do not know that they have been feeling disconnected and are about to tell you so.";
        case "lateral":
          return "This is a catch-up with {{USER}}, a peer. You have pulled back lately and you know it shows, but you have not talked to anyone about why. You assume this is social or about work logistics.";
      }
    },
    simulatedBehavior: (direction, style) => {
      const lines: string[] = [];
      if (direction === "upward") {
        const byStyle: Record<ResponseStyle, string> = {
          defensive:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have not felt connected to the direction things are going, you hear it as criticism of your decisions. You get defensive: you explain the strategy again, remind them of the context they may not see, and only slowly, if they stay honest and non-accusatory, start to hear the person rather than the critique.",
          deflecting:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have pulled back, you move to logistics: workload, a project change, a training. You are more comfortable solving than listening, and you may steer away from the feeling underneath. Only if they hold the conversation on the real issue do you engage with it.",
          emotional:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have not felt connected, it lands on you personally. You may feel you let them down, or feel hurt that they did not come sooner. Your reaction is visible, and {{USER}} has to keep the conversation about them rather than about reassuring you.",
          agreeable:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have pulled back, you are grateful they said it and you say so warmly. But your gratitude is quick and a little shallow; you may move to 'we'll figure it out' without asking what is actually going on. {{USER}} has to keep you in the specifics.",
        };
        lines.push(byStyle[style]);
        return lines.join("\n\n");
      }

      lines.push(
        "HOW YOU BEHAVE IN THIS CONVERSATION. You initially deflect with 'I'm fine' or 'just been busy'. There is a real reason underneath that takes skill to surface: you feel overlooked, or you have a conflict with a peer, or you disagree with a decision, or something personal is bleeding into work, or you are genuinely burned out. Pick one, keep it consistent, and do not volunteer it early. {{USER}} has to create safety first: genuine curiosity, patience, no rush to fix.",
      );
      const byStyle: Record<ResponseStyle, string> = {
        emotional: "Your style here: you may eventually open up, but only if the conversation feels genuinely safe. If it does, it comes out with real feeling. If it does not, you go quieter.",
        defensive: "Your style here: you interpret the check-in as performance management and clam up. 'Is there a problem with my work?' You need {{USER}} to make clear this is not that before you give anything real.",
        deflecting: "Your style here: you stay surface level and redirect to work topics. Status updates, next steps, anything but how you are actually doing.",
        agreeable: "Your style here: you say everything is fine even when it is not. You smile, you reassure, you thank them for asking. A skilled person will notice the gap between what you say and how you have been showing up.",
      };
      lines.push(byStyle[style]);
      if (direction === "lateral") {
        lines.push(
          "Because {{USER}} is your peer, this is less formal and more personal. You are more likely to be honest with them than with a manager, but also more likely to brush it off with humor or 'you know how it is'. If they are real with you, you can be real with them.",
        );
      }
      return lines.join("\n\n");
    },
    debriefLens:
      "Did the user create enough safety for the real issue to surface? Did they listen more than they talked? Did they make the person feel seen rather than managed? Did they leave with a next step or just a check-in?",
  },

  low_motivation: {
    id: "low_motivation",
    label: "Low Motivation Conversation",
    description: "The output is down and the effort is visible to the team. You need to name it without humiliating them.",
    placeholder:
      "e.g. His numbers have dropped for two straight months and his team has noticed. He's capable — this isn't a skill issue. Something is off and it's starting to affect the people around him.",
    baseTitle: "Addressing low motivation and low output",
    title: (u, s) => {
      const d = conversationDirection(u, s);
      if (d === "upward") return `Telling ${simulatedTerm(u, s)} you're running on empty`;
      if (d === "lateral") return "Naming a peer's disengagement";
      return `Addressing low motivation with ${simulatedTerm(u, s)}`;
    },
    userGoal: (direction) => {
      switch (direction) {
        case "downward":
          return "The user needs to name what they are seeing without making the person feel like they are being put on a performance plan. This is a coaching conversation, not a disciplinary one. The trap is being so gentle the severity does not land, or being so blunt it feels like a verdict.";
        case "upward":
          return "The user is telling someone senior to them that they themselves are struggling with motivation. It is extremely vulnerable: 'I've been running on empty and I need to be honest with you about it.' They need to be honest without minimizing or catastrophizing, and ask for what they need.";
        case "lateral":
          return "The user has noticed a peer's disengagement and is naming it. This is delicate: it is not officially their lane. They need to say what they see with care, as a peer who is on their side, without sounding like a manager or a judge.";
      }
    },
    simulatedFraming: (direction) => {
      switch (direction) {
        case "downward":
          return "This is a one-on-one with {{USER}}. Your output has dropped and, though you have not admitted it to yourself, your effort has too. You are capable; this is not a skill problem. You do not think it is as visible as it is.";
        case "upward":
          return "This is a one-on-one that {{USER}} asked for. You expect an update or a request. You do not know they are about to tell you they have been running on empty.";
        case "lateral":
          return "This is a catch-up with {{USER}}, a peer. Your output has slipped and you know your team has noticed, but you did not think it had reached your peers. You assume this is about shared work.";
      }
    },
    simulatedBehavior: (direction, style) => {
      const lines: string[] = [];
      if (direction === "upward") {
        const byStyle: Record<ResponseStyle, string> = {
          defensive:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have been running on empty, your first instinct is to hear it as a problem for the plan rather than a person in front of you. You may push back gently ('we all have a lot on'), ask what it means for delivery, and only if they stay honest and specific do you shift to support.",
          deflecting:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they are running on empty, you go straight to solutions: take a few days, we'll move that deadline, let's get you some help. You are trying to help, but you are also moving past the discomfort quickly. {{USER}} has to slow you down if they want to be heard, not just handled.",
          emotional:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they have been running on empty, it affects you. You may feel responsible, or worried, and you show it. You are supportive, but {{USER}} may end up managing your reaction unless they keep the conversation on what they need.",
          agreeable:
            "HOW YOU BEHAVE IN THIS CONVERSATION. When {{USER}} tells you they are running on empty, you are warm and reassuring immediately: 'of course, whatever you need'. But it is a little dismissive in its ease; you have not asked what is actually going on or what 'whatever you need' means. {{USER}} has to make it concrete.",
        };
        lines.push(byStyle[style]);
        return lines.join("\n\n");
      }

      lines.push(
        "HOW YOU BEHAVE IN THIS CONVERSATION. You are surprised the conversation is happening; you did not realize it was that visible. You may not fully understand what is driving the low output yourself. Underneath it is one of: burnout, feeling disconnected from purpose, personal circumstances, or feeling undervalued. Pick one, keep it consistent, and let it surface only if {{USER}} makes room for it.",
      );
      const byStyle: Record<ResponseStyle, string> = {
        defensive: "Your style here: you dispute the characterization. You cite effort over output: the hours you have put in, the things that are not being counted, the context {{USER}} is missing.",
        deflecting: "Your style here: you point to external blockers, team issues, and resource gaps. The output is down because of things outside your control, and you have the list ready.",
        emotional: "Your style here: you become visibly stressed. You may worry out loud about your job security and ask whether this is a formal thing. {{USER}} has to keep it a coaching conversation while being honest.",
        agreeable: "Your style here: you over-agree. You promise to do better immediately, without understanding what needs to change or what is actually driving it. A skilled person will notice that nothing has been understood.",
      };
      lines.push(byStyle[style]);
      if (direction === "lateral") {
        lines.push(
          "Because {{USER}} is your peer, this is delicate. It is not officially their lane, and part of you wants to say so. Whether you open up or shut down depends on whether they come across as on your side or as someone keeping score.",
        );
      }
      return lines.join("\n\n");
    },
    debriefLens:
      "Did the user name what they observed without judgment? Did they distinguish between effort and output? Did they create space for the real cause to surface? Did they leave the person feeling coached rather than threatened?",
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

export function scenarioTitle(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  return SCENARIOS[id].title(userLevel, simulatedLevel);
}

export function scenarioForDirection(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel, style: ResponseStyle) {
  const direction = conversationDirection(userLevel, simulatedLevel);
  const s = SCENARIOS[id];
  return {
    id,
    label: s.label,
    title: s.title(userLevel, simulatedLevel),
    userGoal: s.userGoal(direction),
    simulatedFraming: s.simulatedFraming(direction),
    simulatedBehavior: s.simulatedBehavior(direction, style),
    debriefLens: s.debriefLens,
  };
}

export const RESPONSE_STYLES: Record<ResponseStyle, { label: string; description: string; prompt: string }> = {
  defensive: {
    label: "Defensive",
    description: "Takes feedback personally, challenges observations, protects ego, pushes back firmly.",
    prompt:
      "Your emotional tone is DEFENSIVE. You take the feedback personally. You challenge the observations {{USER}} is making and question whether they have the full picture. You protect your ego and your record. You push back firmly, but not aggressively. You are not rude, you are hurt and proud.",
  },
  deflecting: {
    label: "Deflecting",
    description: "Shifts blame to circumstances, team capacity, or unclear expectations while staying calm.",
    prompt:
      "Your emotional tone is DEFLECTING. You stay calm and reasonable on the surface, but you steer accountability away from yourself. You point to circumstances, capacity, competing priorities, other departments, or unclear expectations. You rarely say 'that's on me' unless {{USER}} makes it very hard not to.",
  },
  emotional: {
    label: "Emotional",
    description: "Visibly affected. May go quiet or show frustration; the user must manage the message and the person.",
    prompt:
      "Your emotional tone is EMOTIONAL. You are visibly affected by this conversation. You may go quiet, give short answers, sound wounded, or let frustration show. You are not manipulating {{USER}}, you are genuinely struggling with what you are hearing. {{USER}} has to manage both the message and your state.",
  },
  agreeable: {
    label: "Agreeable",
    description: "Says all the right things without real depth or accountability, trying to end the discomfort.",
    prompt:
      "Your emotional tone is AGREEABLE. You say the right things quickly: 'totally fair', 'I hear you', 'I'll fix it'. But your agreement is shallow. You are trying to end the discomfort, not to understand the problem. You do not offer specifics unless pressed, and when pressed you stay vague. A skilled person will notice that nothing real has been committed to.",
  },
};

export const DIFFICULTIES: Record<Difficulty, { label: string; description: string; prompt: string }> = {
  moderate: {
    label: "Moderate",
    description: "Some resistance, workable, allows progress.",
    prompt:
      "DIFFICULTY: MODERATE. Offer some resistance, but be workable. When {{USER}} is specific, respectful, and clear, let the conversation make progress. You can be won over within a reasonable number of exchanges if {{USER}} does the work.",
  },
  challenging: {
    label: "Challenging",
    description: "Real pushback. The user must earn each step.",
    prompt:
      "DIFFICULTY: CHALLENGING. Give real pushback. Do not accept vague observations. Make {{USER}} earn every step: each concession from you should follow something {{USER}} actually did well (a specific example, a genuine question, naming impact honestly). If {{USER}} is vague, retreats, or over-reassures, do not reward it.",
  },
  realistic: {
    label: "Realistic",
    description: "Fully realistic. May include denial, emotional reactivity, or flipping accountability back on the user.",
    prompt:
      "DIFFICULTY: REALISTIC. Respond as a real person would in a hard meeting. This may include denial, emotional reactivity, long silences, or flipping accountability back onto {{USER}} ('When did you last raise any of this?'). You are not being difficult for its own sake; you are being human. Progress is possible but only through genuine skill, and it may not fully arrive in one meeting.",
  },
};
