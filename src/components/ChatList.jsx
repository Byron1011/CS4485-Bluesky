import PropTypes from "prop-types";

export default function ChatList({ chats, onSelectChat }) {
  return (
    <ul className="chat-list">
      {chats.map((name) => (
        <li
          key={name}
          className="chat-item"
          onClick={() => onSelectChat(name)}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

ChatList.propTypes = {
  chats: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectChat: PropTypes.func.isRequired,
};
