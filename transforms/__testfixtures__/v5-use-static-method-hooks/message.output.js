import { App as AntdApp } from 'antd';

const App = () => {
  const {
    message
  } = AntdApp.useApp();

  const onClick1 = () => {
    message.warning();
  }
  return <></>;
};
