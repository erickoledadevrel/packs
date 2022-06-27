import * as coda from "@codahq/packs-sdk";
import * as _ from "lodash";

export const UserSchema = coda.makeObjectSchema({
  properties: {
    name: { type: coda.ValueType.String, codaType: coda.ValueHintType.Html, fromKey: "display_name" },
    user_id: { type: coda.ValueType.Number },
    reputation: { type: coda.ValueType.Number },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    profile_image: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    created: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.DateTime,
      fromKey: "creation_date"
    },
  },
  displayProperty: "name",
  idProperty: "user_id",
});

export const CommentSchema = coda.makeObjectSchema({
  properties: {
    comment_id: { type: coda.ValueType.Number },
    content: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Markdown,
      fromKey: "body_markdown",
    },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    score: { type: coda.ValueType.Number },
    created: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.DateTime,
      fromKey: "creation_date"
    },
    owner: UserSchema,
  },
  displayProperty: "owner",
  idProperty: "comment_id",
  featuredProperties: ["link"]
});

export const AnswerSchema = coda.makeObjectSchema({
  properties: {
    answer_id: { type: coda.ValueType.Number },
    content: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Markdown,
      fromKey: "body_markdown",
    },
    snippet: { type: coda.ValueType.String },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    score: { type: coda.ValueType.Number },
    created: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.DateTime,
      fromKey: "creation_date"
    },
    owner: UserSchema,
    comments: { type: coda.ValueType.Array, items: CommentSchema },
    is_accepted: { type: coda.ValueType.Boolean },
  },
  displayProperty: "snippet",
  idProperty: "answer_id",
  featuredProperties: ["link"]
});

export const QuestionSchema = coda.makeObjectSchema({
  properties: {
    title: { type: coda.ValueType.String, codaType: coda.ValueHintType.Html },
    question_id: { type: coda.ValueType.Number },
    content: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Markdown,
      fromKey: "body_markdown",
    },
    tags: {
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    link: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    is_answered: { type: coda.ValueType.Boolean },
    view_count: { type: coda.ValueType.Number },
    answer_count: { type: coda.ValueType.Number },
    score: { type: coda.ValueType.Number },
    bounty: { type: coda.ValueType.Number, fromKey: "bounty_amount" },
    created: {
      type: coda.ValueType.Number,
      codaType: coda.ValueHintType.DateTime,
      fromKey: "creation_date"
    },
    owner: UserSchema,
    answers: { type: coda.ValueType.Array, items: AnswerSchema },
    accepted_answer: AnswerSchema,
    comments: { type: coda.ValueType.Array, items: CommentSchema },
  },
  displayProperty: "title",
  idProperty: "question_id",
  featuredProperties: ["tags", "link"]
});

export function formatQuestion(question) {
  question.body_markdown = _.unescape(question.body_markdown);
  question.answers = question.answers?.map(formatAnswer);
  question.accepted_answer = question.answers?.find(answer => answer.answer_id == question.accepted_answer_id);
  return question;
}

function formatAnswer(answer) {
  answer.snippet = answer.body?.substring(0, 100);
  return answer;
}