import { App as AntdApp } from 'antd';

const App = () => {
  const {
    notification
  } = AntdApp.useApp();

  const onClick1 = () => {
    notification.info();
  }
  const onClick2 = () => {
    notification.info();
  }
  const onClick3 = () => {
    notification.info();
  }
  return <></>;
};
