export function buildPrompt({ thread, instruction, agentName = "Brian", agencyName = "Creators United", examples = [], onBehalf = false, creatorName = "" }) {
  const exBlock = examples.map((e, i) => `--- Example ${i+1} (your past reply) ---\n${(e.text||"").trim()}`).join("\n\n");
  const persona = `You are ${agentName} at ${agencyName}. Be concise, friendly, and professional.`;

  const rules = [
    onBehalf
      ? `You are replying on behalf of a creator. Start with: "Hi {FirstName},\\n\\nThanks for reaching out! I'm ${agentName} at ${agencyName}, and I represent ${creatorName || "{{CreatorName}}" }." Then speak as we/us/our. Avoid I/me/my.`
      : `You are replying as ${agentName}. Use I/me/my appropriately.`,
    `If discussing compensation, phrase as "${creatorName || "{{CreatorName}}" }'s rate" (not "my rate").`,
    `Always end with:\\nThanks,\\n${agentName}`
  ].join("\n");

  const user = [
    exBlock ? `Here are some of my past replies for tone:\n\n${exBlock}` : ``,
    `--- Thread Context ---\n${thread}`.trim(),
    instruction ? `--- My Instruction ---\n${instruction.trim()}` : ``,
    `--- Rules ---\n${rules}`
  ].filter(Boolean).join("\n\n");

  return { system: persona, user };
}
