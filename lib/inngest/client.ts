import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "hellobrand",
  eventKey: process.env.INNGEST_EVENT_KEY
});
